# Security Policy

## Supported Versions

We release patches for security vulnerabilities for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security vulnerability, please follow these steps:

### For Critical Security Issues

1. **DO NOT** open a public GitHub issue
2. Send an email to [your-email@example.com] with:
   - A description of the vulnerability
   - Steps to reproduce the issue
   - Potential impact
   - Any suggested fixes

### For Non-Critical Issues

You can open a GitHub issue with the "security" label.

## Security Measures

This project follows these security practices:

- **Dependency Scanning**: Automated dependency vulnerability scanning via GitHub Dependabot
- **Code Analysis**: Static code analysis in CI/CD pipeline
- **Regular Updates**: Dependencies are regularly updated
- **Minimal Dependencies**: We keep dependencies to a minimum to reduce attack surface

## Response Time

- **Critical vulnerabilities**: We aim to respond within 24 hours
- **Non-critical vulnerabilities**: We aim to respond within 7 days

## Disclosure Policy

- We will acknowledge receipt of your vulnerability report within 24 hours
- We will provide an estimated timeline for a fix
- We will notify you when the vulnerability is fixed
- We will publicly disclose the vulnerability after a fix is released (unless you prefer otherwise)

## Security Best Practices for Users

When using Codeplot:

1. **API Keys**: Always store your Gemini API key securely using environment variables
2. **Updates**: Keep Codeplot updated to the latest version
3. **Review Output**: Always review generated ADRs and implementation plans before implementing
4. **Sensitive Data**: Be cautious when using Codeplot with repositories containing sensitive information

## Bug Bounty

Currently, we do not offer a bug bounty program, but we greatly appreciate security research and will acknowledge contributors in our security advisories.
