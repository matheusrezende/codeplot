# Security Policy

## Supported Versions

We currently support the following versions with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security vulnerability, please follow these steps:

### 1. **Do NOT** create a public GitHub issue

Security vulnerabilities should not be reported through public GitHub issues.

### 2. **Report privately**

Please report security vulnerabilities through one of these methods:

- **GitHub Security Advisories**: [Create a private security advisory](https://github.com/matheusrezende/codeplot/security/advisories/new)
- **Email**: Send details to `matheus@mozzaik365.com`

### 3. **Include details**

Please include the following information in your report:

- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact of the vulnerability
- Suggested fix (if you have one)
- Your contact information for follow-up

### 4. **Response timeline**

- **Acknowledgment**: We will acknowledge receipt of your report within 48 hours
- **Assessment**: We will assess the vulnerability within 7 days
- **Fix timeline**: Critical vulnerabilities will be addressed within 30 days
- **Disclosure**: We will coordinate disclosure timing with you

## Security Best Practices

### For Users

- Always use the latest version of Codeplot
- Keep your Node.js version updated (>=20.0.0)
- Use environment variables for sensitive information like API keys
- Never commit API keys or secrets to your repository
- Regularly audit your dependencies with `npm audit`

### For Contributors

- Follow secure coding practices
- Run security scans before submitting PRs
- Keep dependencies updated
- Use semantic versioning for security fixes
- Document any security-related changes

## Automated Security

This repository includes several automated security measures:

- **Dependabot**: Automatically updates vulnerable dependencies
- **Security Advisories**: GitHub scans for known vulnerabilities
- **Secret Scanning**: Prevents accidental commit of secrets
- **Code Scanning**: CodeQL analysis for security issues
- **Dependency Review**: Reviews dependencies in PRs

## Security Tools

We use the following tools to maintain security:

- **npm audit**: Vulnerability scanning for dependencies
- **CodeQL**: Static analysis for security issues
- **ESLint**: Code quality and security linting
- **Volta**: Consistent Node.js version management
- **Semantic Release**: Secure automated releases

## Contact

For any security-related questions or concerns, please contact:

- **Email**: matheus@mozzaik365.com
- **GitHub**: [@matheusrezende](https://github.com/matheusrezende)

Thank you for helping keep Codeplot secure! 🔒
