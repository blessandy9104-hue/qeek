#!/bin/bash
# Release script using changesets

set -euo pipefail

echo "🚀 Starting release process..."

# Check if we're on main branch
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ]; then
    echo "❌ Releases must be from main branch"
    exit 1
fi

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo "❌ Uncommitted changes detected"
    exit 1
fi

# Install changesets if not present
if ! command -v changeset &> /dev/null; then
    echo "Installing changesets..."
    pnpm add -D @changesets/cli
fi

# Version bump
echo "📦 Computing version bump..."
pnpm changeset version

# Build
echo "🔨 Building..."
pnpm run build

# Test
echo "🧪 Testing..."
pnpm test

# Publish to npm
echo "📤 Publishing to npm..."
pnpm changeset publish

# Push tags
echo "🏷️ Pushing tags..."
git push --follow-tags

# Create GitHub release
echo "📝 Creating GitHub release..."
gh release create "v$(node -p "require('./package.json').version")" \
    --generate-notes \
    --latest

echo "✅ Release complete!"