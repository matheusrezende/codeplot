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
5. **Commit with clear messages**: `git commit -m 'Add amazing feature'`
6. **Push to your branch**: `git push origin feature/amazing-feature`
7. **Open a Pull Request**

### 📝 Code Style
- Use ES6+ features
- Follow existing code patterns
- Add comments for complex logic
- Use meaningful variable names

### 🧪 Testing
- Test your changes manually
- Ensure existing functionality isn't broken
- Include test cases for new features when possible

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
