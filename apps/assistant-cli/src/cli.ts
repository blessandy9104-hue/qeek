#!/usr/bin/env node

import { boot } from '@qeek/qeek-host';

async function main() {
  // SIGINT lifecycle is owned by the REPL (stops mathcore, closes readline).
  await boot();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
