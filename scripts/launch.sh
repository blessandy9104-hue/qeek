#!/bin/bash
# Personal Assistant AI - Launch Script

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🚀 Personal Assistant AI - Starting up..."

# Check if mathcore is installed (vendored at ./mathcore)
if ! command -v mathcore-mcp &> /dev/null; then
    echo "📦 Installing mathcore..."
    pip install -e ./mathcore
fi

# Check if node_modules exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing npm dependencies..."
    pnpm install
fi

# Build if needed
if [ ! -d "packages/core/dist" ]; then
    echo "🔨 Building packages..."
    pnpm run build
fi

# Start the assistant
echo "✨ Starting Zoveli AI..."
pnpm start