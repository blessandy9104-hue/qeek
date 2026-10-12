# Runbook: Capability Scan Failures

## Symptoms
- `capability_scan` tool returns error or empty results
- Agent reports missing capabilities
- Capability report shows degraded/unavailable

## Diagnosis Steps

### 1. Check Scanner Health
```bash
# Run capability scan manually
pnpm exec tsx packages/capability/src/scanner.ts scan --deep

# Check logs
grep "CapabilityScanner" logs/qeek.log
```

### 2. Verify MCP Connections
```bash
# Check mathcore MCP
mathcore-mcp --version
mathcore "2 + 2"

# Check other MCP servers
npx @modelcontextprotocol/server-filesystem --version
```

### 3. Check External Binaries
```bash
# Verify required binaries
which docker git python3 node
docker --version
git --version
python3 --version
node --version
```

### 4. Check Plugin Loading
```bash
# List loaded plugins
pnpm exec tsx -e "
const { createDsh } = require('@deepseek-ai/dsh-core');
const dsh = await createDsh({ profile: 'personal-assistant-headless' });
console.log(dsh.plugins.map(p => p.name));
"
```

## Resolution

### MCP Server Not Starting
```bash
# Reinstall mathcore
pip install -e ../mathcore --force-reinstall

# Check audit log path
ls -la ~/.mathcore/audit.jsonl
```

### Plugin Not Registering Capabilities
- Verify plugin `setup(ctx)` calls `ctx.register('capability-*', ...)`
- Check plugin loads in profile config
- Verify plugin package.json has correct exports

### External Binary Missing
```bash
# Install missing binaries
# Ubuntu/Debian
apt-get install -y docker.io git python3 nodejs

# macOS
brew install docker git python node

# Windows
winget install Docker.DockerDesktop Git.Git Python.Python.3.11 OpenJS.NodeJS
```

## Escalation
If unresolved after 30 minutes:
1. Collect diagnostic bundle: `pnpm run capability:report > capability-report.json`
2. Check GitHub Issues for similar problems
3. Contact: blessandy9104@gmail.com

## Prevention
- Health checks in CI/CD
- Startup validation of critical capabilities
- Automated dependency updates via Dependabot
