#!/bin/bash
set -e

echo ""
echo "═══════════════════════════════════════════════════"
echo "  OVERALLS OUTREACH — INITIAL SETUP"
echo "═══════════════════════════════════════════════════"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Install Node.js 20+ first."
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js $NODE_VERSION found. Need 18+."
    exit 1
fi
echo "✅ Node.js $(node -v)"

# Install server dependencies
echo ""
echo "📦 Installing server dependencies..."
npm install

# Install client dependencies
echo ""
echo "📦 Installing client dependencies..."
cd client && npm install && cd ..

# Create data directory
mkdir -p data

# Copy env template if needed
if [ ! -f .env ]; then
    cp .env.example .env
    echo ""
    echo "📝 Created .env from template."
    echo "   ⚠️  YOU MUST edit .env and add your API keys!"
fi

echo ""
echo "═══════════════════════════════════════════════════"
echo "  SETUP COMPLETE"
echo "═══════════════════════════════════════════════════"
echo ""
echo "  Next steps:"
echo "  1. Edit .env with your API keys"
echo "  2. Run: npm run test-connections"
echo "  3. Run: npm run auth-gmail"
echo "  4. Run: npm run dev  (start API server)"
echo "  5. In a new terminal: cd client && npm run dev"
echo "  6. Open http://localhost:3000"
echo ""
