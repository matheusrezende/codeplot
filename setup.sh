#!/bin/bash

echo "📊  Codeplot Setup"
echo "========================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    echo "📥 Please install Node.js (>=18.0.0) from:"
    echo "   https://nodejs.org/"
    echo "   or use a version manager like nvm:"
    echo "   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
    echo "   nvm install --lts"
    exit 1
fi

echo "✅ Node.js is installed: $(node --version)"

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not available"
    exit 1
fi

echo "✅ npm is available: $(npm --version)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Make CLI globally available
echo "🔗 Making CLI globally available..."
npm link

if [ $? -eq 0 ]; then
    echo "✅ CLI linked successfully"
else
    echo "❌ Failed to link CLI"
    exit 1
fi

echo ""
echo "🎉 Setup completed!"
echo ""
echo "Next steps:"
echo "1. Set your Gemini API key:"
echo "   export GEMINI_API_KEY='your_api_key_here'"
echo ""
echo "2. Test the CLI:"
echo "   codeplot init"
echo ""
echo "3. Plan a feature:"
echo "   codeplot plan --project-path /path/to/your/project"
