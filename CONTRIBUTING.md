# Contributing to Codeplot

Thank you for your interest in contributing to Codeplot! 🎉

## How to Contribute

### 🐛 Bug Reports

- Use the GitHub issue tracker
- Include clear reproduction steps
- Provide system information (Node.js version, OS, etc.)

### 💡 Feature Requests

- Describe the feature and its use case
- Explain how it would benefit users
- Consider implementation complexity

### 🛠️ Code Contributions

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes**
4. **Test thoroughly**
5. **Follow commit conventions** (see below)
6. **Push to your branch**: `git push origin feature/amazing-feature`
7. **Open a Pull Request**

### 📝 Code Style

- Use ES6+ features
- Follow existing code patterns
- Add comments for complex logic
- Use meaningful variable names

### 📝 Commit Message Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/) to ensure consistent and semantic commit messages. This helps with automatic changelog generation and semantic versioning.

**Format:**

```
type(scope): description

[optional body]

[optional footer(s)]
```

**Types:**

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `build`: Changes that affect the build system or external dependencies
- `ci`: Changes to our CI configuration files and scripts
- `chore`: Other changes that don't modify src or test files
- `revert`: Reverts a previous commit

**Examples:**

```bash
feat: add interactive planning session
fix: resolve streaming display issue
docs: update installation instructions
refactor: extract chat session logic
test: add unit tests for repo packager
```

**Rules:**

- Use lowercase for the type and description
- Keep the first line under 100 characters
- Use present tense ("add" not "added")
- Don't end the subject line with a period
- Use the body to explain what and why, not how

**Commitlint** will automatically validate your commit messages when you commit.

### 🧪 Testing

- Test your changes manually
- Ensure existing functionality isn't broken
- Include test cases for new features when possible
- Run `npm test` before committing

### 📚 Documentation

- Update README.md if needed
- Add JSDoc comments for new functions
- Update DEMO.md for new features

## Development Setup

```bash
# Clone your fork
git clone https://github.com/your-username/codeplot.git

# Install dependencies
npm install

# Make it globally available for testing
npm link

# Test your changes
codeplot init
```

## Project Structure

```
src/
├── index.js              # CLI entry point
├── feature-architect.js  # Main orchestrator
├── chat-session.js       # AI interaction logic
├── repo-packager.js      # Repository analysis
└── adr-generator.js      # ADR generation
```

## Questions?

Feel free to open an issue for discussion or reach out to the maintainers.

Happy coding! 🚀
