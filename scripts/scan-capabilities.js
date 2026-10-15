#!/usr/bin/env node
/**
 * Scan all Zoveli capabilities and print JSON.
 *
 * Usage:
 *   pnpm run build                       # required first (uses dist output)
 *   node scripts/scan-capabilities.js            # quick scan
 *   node scripts/scan-capabilities.js --deep    # with live verification probes
 */
const { CapabilityScanner } = require('../packages/capability/dist/scanner.js');

async function main() {
  const deep = process.argv.includes('--deep');
  const scanner = new CapabilityScanner({ config: {}, plugins: [] });
  const caps = await scanner.scanAll({ deep });
  console.log(
    JSON.stringify(
      caps.map((c) => ({
        name: c.name,
        displayName: c.displayName,
        category: c.category,
        status: c.status,
        priority: c.priority,
        provides: c.provides,
        plugin: c.metadata.pluginId || c.metadata.mcpServer || null,
      })),
      null,
      2
    )
  );
  const available = caps.filter((c) => c.status === 'available').length;
  console.error(`\n${available}/${caps.length} capabilities available`);
}

main().catch((e) => {
  console.error('scan failed:', e.message);
  process.exit(1);
});

