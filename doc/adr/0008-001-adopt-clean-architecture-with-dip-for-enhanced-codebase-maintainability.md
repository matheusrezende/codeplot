# ADR: 20250628-001 - Adopt Clean Architecture with DIP for Enhanced Codebase Maintainability

## Status

Proposed

## Context

The current codebase lacks a clear separation of concerns, making it difficult to maintain, test, and extend. Refactoring to Clean Architecture principles, with a focus on the Dependency Inversion Principle (DIP), will improve the codebase's structure, testability, and overall maintainability. The initial focus will be on refactoring `src/feature-architect.js` and `src/chat-session.js`. Session management will be completely removed, and the existing CLI options and related code will be removed. The existing logging system will be moved to the Frameworks & Drivers layer. UI interactions will be handled through Use Cases, with Data Transfer Objects (DTOs) used for data flow. Error handling will be centralized with layer-specific transformations. `RepoPackager` and `ADRGenerator` will be encapsulated as Framework Services. Use Cases will be structured with a single class per action, and Entities will be plain JavaScript objects validated within the Entities using a validation library.

## Decision

Adopt Clean Architecture principles, focusing on the Dependency Inversion Principle (DIP), using a "Big Bang Rewrite" approach.

- **Layers:** Implement the core Clean Architecture layers: Entities, Use Cases, Interface Adapters, and Frameworks & Drivers.
- **Dependency Inversion:** Ensure high-level modules do not depend on low-level modules. Both should depend on abstractions. Abstractions should not depend on details; details should depend on abstractions.
- **Modules:** Initially focus on refactoring `src/feature-architect.js` and `src/chat-session.js`.
- **External Dependencies:** Keep external dependencies like `@google/generative-ai`, `commander`, `fs-extra`, `ink`, and `inquirer` within the Frameworks & Drivers layer.
- **Session Management:** Completely remove session management, including related CLI options and code.
- **Logging:** Move the existing logging system (`src/utils/logger.js`) to the Frameworks & Drivers layer.
- **UI Interaction:** Create Use Cases for UI interactions.
- **Data Flow:** Use Data Transfer Objects (DTOs) for data flow between the UI components, the Use Cases, and the Entities.
- **Error Handling:** Implement centralized error handling with layer-specific transformations.
- **Framework Services:** Encapsulate `RepoPackager` and `ADRGenerator` as Framework Services.
- **Use Cases:** Structure Use Cases with a single class per action.
- **Entities:** Use plain JavaScript objects for Entities.
- **Validation:** Validate data within Entities using a validation library.

## Consequences

### Positive

- Improved maintainability due to clear separation of concerns.
- Increased testability as each layer can be tested independently.
- Enhanced flexibility, allowing for easier adaptation to future changes.
- Better code organization and readability.
- Centralized error handling simplifies debugging and maintenance.

### Negative

- Significant initial effort required for the "Big Bang Rewrite."
- Potential for introducing bugs during the refactoring process.
- Increased complexity due to the introduction of new layers and abstractions.
- Risk of disrupting current functionality if not carefully executed.
- Complete removal of session management may impact user experience for some users.

## Implementation Plan

### Phase 1: Core Layer Definition and Structure

- [ ] Create the Entities layer with plain JavaScript objects.
- [ ] Define DTOs for data transfer between layers.
- [ ] Implement validation within Entities using a validation library (e.g., Joi, Yup).
  - **File**: `src/entities/feature.js` (example)
  - **File**: `src/dtos/feature-dto.js` (example)
- [ ] Create the Use Cases layer with single classes per action.
  - **File**: `src/use-cases/plan-feature.js` (example)
- [ ] Define interfaces for Use Case execution.
  - **File**: `src/use-cases/interfaces/plan-feature-interface.js` (example)

### Phase 2: Refactoring `feature-architect.js` and `chat-session.js`

- [ ] Refactor `src/feature-architect.js` to use the new Clean Architecture layers.
  - Move core logic to Use Cases.
  - Implement Dependency Inversion for external dependencies.
- [ ] Refactor `src/chat-session.js` to use the new Clean Architecture layers.
  - Move AI communication logic to Use Cases.
  - Implement Dependency Inversion for external dependencies.
- [ ] Remove session management code from `src/feature-architect.js` and `src/chat-session.js`.
- [ ] Move the existing logging system (`src/utils/logger.js`) to the Frameworks & Drivers layer.
  - **File**: `src/frameworks/logger.js`
- [ ] Implement centralized error handling with layer-specific transformations.
  - **File**: `src/frameworks/error-handler.js`
- [ ] Encapsulate `RepoPackager` and `ADRGenerator` as Framework Services.
  - **File**: `src/frameworks/repo-packager-service.js`
  - **File**: `src/frameworks/adr-generator-service.js`

### Phase 3: UI Integration and Testing

- [ ] Create Use Cases for UI interactions.
  - **File**: `src/use-cases/display-chat-interface.js` (example)
- [ ] Structure data flow between the UI components, the Use Cases, and the Entities using DTOs.
- [ ] Remove the CLI options and related code for session management from `src/index.js`.
- [ ] Update UI components (`src/ui/`) to interact with the new Use Cases.
- [ ] Implement unit tests for each layer, focusing on Use Cases and Entities.
  - **File**: `src/__tests__/use-cases/plan-feature.test.js` (example)
  - **File**: `src/__tests__/entities/feature.test.js` (example)
- [ ] Implement integration tests to ensure proper interaction between layers.

## Alternatives Considered

### Alternative 1: Incremental Refactoring

- **Description**: Refactor the codebase incrementally, module by module, to align with Clean Architecture principles.
- **Pros**: Lower risk of introducing breaking changes, easier to manage the refactoring process.
- **Cons**: Slower progress, potential for inconsistencies between refactored and non-refactored modules.
- **Rejected because**: The user specified a "Big Bang Rewrite" approach.

### Alternative 2: Microservices Architecture

- **Description**: Decompose the application into smaller, independent microservices, each following Clean Architecture principles.
- **Pros**: Improved scalability, easier to deploy and manage individual services.
- **Cons**: Increased complexity due to distributed architecture, higher infrastructure costs.
- **Rejected because**: Overkill for the current application size and complexity.

## Definition of Done

- [ ] All core logic from `src/feature-architect.js` and `src/chat-session.js` has been moved to Use Cases.
- [ ] All external dependencies are encapsulated within the Frameworks & Drivers layer.
- [ ] Session management code has been completely removed.
- [ ] The logging system has been moved to the Frameworks & Drivers layer.
- [ ] UI interactions are handled through Use Cases.
- [ ] Data flow between UI, Use Cases, and Entities is structured using DTOs.
- [ ] Centralized error handling is implemented with layer-specific transformations.
- [ ] `RepoPackager` and `ADRGenerator` are encapsulated as Framework Services.
- [ ] Use Cases are structured with a single class per action.
- [ ] Entities are plain JavaScript objects validated within the Entities using a validation library.
- [ ] Unit tests cover all Use Cases and Entities with a coverage of at least 80%.
- [ ] Integration tests ensure proper interaction between layers.
- [ ] Codebase adheres to Clean Architecture principles and DIP.
- [ ] Code has been reviewed and approved by senior developers.
- [ ] Documentation has been updated to reflect the new architecture.
