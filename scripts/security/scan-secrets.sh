#!/bin/bash
# Secret scanning script
# Uses truffleHog to detect secrets in git history

set -euo pipefail

echo "🔍 Scanning for secrets..."

# Check if truffleHog is installed
if ! command -v trufflehog &> /dev/null; then
    echo "Installing truffleHog..."
    curl -sSfL https://raw.githubusercontent.com/trufflesecurity/trufflehog/main/scripts/install.sh | sh -s -- -b /usr/local/bin
fi

# Scan entire repo
trufflehog filesystem --directory=. --fail --json > trufflehog-results.json || true

# Check results
if [ -s trufflehog-results.json ]; then
    echo "❌ Secrets detected!"
    cat trufflehog-results.json | jq -r '.[] | "\(.DetectorType): \(.Raw) at \(.SourceMetadata.Data.Files[0].file):\(.SourceMetadata.Data.Files[0].line)"'
    exit 1
else
    echo "✅ No secrets found"
fi