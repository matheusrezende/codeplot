# Quick Installation Guide

## 🚀 For Users (Recommended)

### Global Installation

```bash
npm install -g codeplot
```

### Using npx (No Installation)

```bash
npx codeplot init
npx codeplot plan
```

### API Key Setup

```bash
export GEMINI_API_KEY="your_api_key_here"
```

## 🛠️ For Contributors

### Prerequisites

- Node.js >=20.0.0
- Volta (recommended)

### Setup

```bash
# Install Volta (recommended)
curl https://get.volta.sh | bash

# Clone and setup
git clone https://github.com/your-username/codeplot.git
cd codeplot
npm install
npm link

# Test
codeplot init
```

For detailed instructions, see [CONTRIBUTING.md](CONTRIBUTING.md).
