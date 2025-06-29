### **ADR-001: Adopt a Dependency Injection (DI) Container**

**Date**: 2024-08-01

**Status**: Accepted

**Context**:
The application currently uses direct class instantiation (e.g., `new Service()`). This creates tight coupling between components, making them difficult to test in isolation and harder to maintain. As we plan to expand the application with more agents (e.g., for PRD generation) and tool integrations (Notion, Confluence), managing the creation and wiring of these dependencies will become increasingly complex and error-prone. We need a scalable mechanism for managing object lifecycles and dependencies.

**Decision**:
We will integrate the `tsyringe` library to manage the lifecycle and injection of our application's services. All major classes (agents, managers, packagers) will be registered with a central DI container. Dependencies will be resolved automatically by the container using TypeScript decorators (`@injectable()`, `@inject()`). This pattern is known as Inversion of Control (IoC).

The container will be configured in a dedicated file (`src/container.ts`) and used at the application's entry point (`src/index.ts`) to build the initial object graph.

**Consequences**:

- **Positive**:
  - **Improved Testability**: Dependencies can be easily replaced with mock objects in tests, allowing for true unit testing.
  - **Reduced Coupling**: Classes no longer need to know how to create their dependencies, leading to better modularity.
  - **Centralized Configuration**: The application's object graph is defined in one place, making it easier to understand and modify.
  - **Scalability**: Adding new services or swapping implementations (e.g., a different `RepoPackager`) becomes a configuration change in the container, without altering the consuming classes.

- **Negative**:
  - **Added Dependency**: Introduces `tsyringe` and its peer dependency `reflect-metadata` into the project.
  - **Configuration Overhead**: Requires enabling `experimentalDecorators` and `emitDecoratorMetadata` in `tsconfig.json`.
  - **Learning Curve**: The team must understand DI principles and the `tsyringe` decorator syntax.
  - **Slight Runtime Overhead**: The DI container adds a minor performance overhead during application startup and dependency resolution.

**Rejected Alternatives**:

- **Manual Dependency Injection**: While it improves testability, it would lead to verbose constructor signatures and complex manual wiring in `index.ts` as the application grows. The user explicitly chose a more scalable approach.
- **Keep Current Structure with `jest.mock`**: This approach leads to brittle tests that are coupled to implementation details (like file paths of modules). It doesn't solve the underlying architectural problem of tight coupling.

---

### **Implementation Plan**

This refactoring will be done in isolated, shippable steps.

**Step 1: Project Setup & Configuration**

1.  **Install dependencies**:
    ```bash
    npm install tsyringe reflect-metadata
    ```
2.  **Update `tsconfig.json`**: Enable decorators by adding/updating these options under `compilerOptions`.
    ```json
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    ```
3.  **Update Entry Point**: Import `reflect-metadata` at the very top of `src/index.ts`. This must be the first import.
    ```typescript
    // src/index.ts
    import 'reflect-metadata';
    import { Command } from 'commander';
    // ... rest of the file
    ```

**Step 2: Create DI Container and Register Services**

1.  **Create `src/container.ts`**: This file will configure our DI container.

    ```typescript
    // src/container.ts (initial stub)
    import { container } from 'tsyringe';
    import { AgentOrchestrator } from './agents/AgentOrchestrator';
    import { ADRGeneratorAgent } from './agents/ADRGeneratorAgent';
    import { PlanningAgent } from './agents/PlanningAgent';
    import { FeatureArchitect } from './feature-architect';

    // We will register our classes here
    // Example for a class with no complex constructor args:
    // container.register<AgentOrchestrator>(AgentOrchestrator);

    export default container;
    ```

2.  **Refactor `AgentOrchestrator` and Agents**:
    - Add `@injectable()` to `AgentOrchestrator`, `PlanningAgent`, and `ADRGeneratorAgent` classes.
    - Update their constructors to receive dependencies via injection. For now, they take `apiKey` and `modelName` as simple arguments, which we will handle via factories.

    ```typescript
    // src/agents/AgentOrchestrator.ts
    import { injectable, inject } from 'tsyringe';
    import { PlanningAgent } from './PlanningAgent';
    import { ADRGeneratorAgent } from './ADRGeneratorAgent';

    @injectable()
    export class AgentOrchestrator {
      constructor(
        @inject(PlanningAgent) private planningAgent: PlanningAgent,
        @inject(ADRGeneratorAgent) private adrGeneratorAgent: ADRGeneratorAgent
      ) {
        // The API key will be passed when creating the agents via the container
      }
      // ...
    }
    ```

**Step 3: Update `FeatureArchitect`**

1.  **Modify `FeatureArchitect` to use DI**:
    - Add the `@injectable()` decorator.
    - Inject `SessionManager`, `RepoPackager`, `ADRGenerator`, and `AgentOrchestrator` via the constructor.

    ```typescript
    // src/feature-architect.ts
    import { injectable, inject } from 'tsyringe';
    // ... other imports

    @injectable()
    export class FeatureArchitect {
      constructor(
        @inject('FeatureArchitectOptions') private options: FeatureArchitectOptions,
        @inject(SessionManager) public sessionManager: SessionManager,
        @inject(RepoPackager) public repoPackager: RepoPackager,
        @inject(ADRGenerator) public adrGenerator: ADRGenerator
        // ... other injections
      ) {
        // ...
      }
      // ...
    }
    ```

**Step 4: Update Application Bootstrap**

1.  **Modify `src/index.ts` to use the container**:
    - Instead of `new FeatureArchitect(options)`, we will resolve it from the container. We'll need to register the runtime `options` object with the container first.

    ```typescript
    // src/index.ts
    import 'reflect-metadata';
    import container from './container';
    import { FeatureArchitect } from './feature-architect';

    // Inside the commander action
    program.command('plan').action(async (options: PlanOptions) => {
      // Register runtime options with the container
      container.register('FeatureArchitectOptions', { useValue: options });

      // Resolve the main application class
      const architect = container.resolve(FeatureArchitect);

      // Pass the resolved instance to the UI
      render(React.createElement(App, { featureArchitect: architect }));
    });
    ```

2.  **Update `src/ui/App.jsx`**:
    - Remove the `useState` and `useEffect` logic that creates the `FeatureArchitect` instance.
    - Receive the `featureArchitect` instance directly as a prop. This significantly simplifies the `App` component.

    ```jsx
    // src/ui/App.jsx
    const App = ({ featureArchitect }) => {
      // <-- Receive as prop
      const { exit } = useApp();
      const [appState, setAppState] = useState('initializing');

      useEffect(() => {
        // The architect is already created, so we can use it directly.
        const initialize = async () => {
          // ... initialization logic using the passed 'featureArchitect' prop
        };
        initialize();
      }, [featureArchitect]); // Re-run if the prop changes

      // ... rest of the component
    };
    ```

**Step 5: Add a Sample Test**

1.  **Create `src/agents/AgentOrchestrator.test.ts`**:
    - This test will demonstrate how to use the DI container to inject mocks.

    ```typescript
    // src/__tests__/agents/AgentOrchestrator.test.ts
    import 'reflect-metadata';
    import { container } from 'tsyringe';
    import { AgentOrchestrator } from '../../agents/AgentOrchestrator';
    import { PlanningAgent } from '../../agents/PlanningAgent';

    // Create mock classes
    class MockPlanningAgent extends PlanningAgent {
      // Override methods for testing
    }

    describe('AgentOrchestrator', () => {
      beforeEach(() => {
        // Clear and configure the container for each test
        container.clearInstances();
        container.register<PlanningAgent>(PlanningAgent, { useClass: MockPlanningAgent });
        // Mock other dependencies as well...
      });

      it('should start with the planning phase', async () => {
        const orchestrator = container.resolve(AgentOrchestrator);
        // ... test logic
      });
    });
    ```

---

This completes the plan for the first refactoring. Once you approve, I will proceed with my next question. What is the next most important area to focus on?
