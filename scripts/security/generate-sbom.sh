#!/bin/bash
# SBOM generation script
# Uses Syft to generate Software Bill of Materials

set -euo pipefail

echo "📦 Generating SBOM..."

# Check if syft is installed
if ! command -v syft &> /dev/null; then
    echo "Installing syft..."
    curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh -s -- -b /usr/local/bin
fi

# Generate SBOM in multiple formats
syft dir:. -o spdx-json=sbom.spdx.json
syft dir:. -o cyclonedx-json=sbom.cyclonedx.json
syft dir:. -o table=sbom.table.txt

echo "✅ SBOM generated:"
ls -la sbom.*

# Sign SBOM with cosign if available
if command -v cosign &> /dev/null && [ -n "${COSIGN_PRIVATE_KEY:-}" ]; then
    echo "🔏 Signing SBOM..."
    cosign sign-blob --yes sbom.spdx.json > sbom.spdx.json.sig
    cosign sign-blob --yes sbom.cyclonedx.json > sbom.cyclonedx.json.sig
    echo "✅ SBOM signed"
fi