import { QeekHost } from './host.js';
import { runRepl } from './repl.js';
import { chatConfigFromEnv } from './chat.js';
import { assistantCore } from '@personal-assistant/assistant-core';
import { assistantMath } from '@personal-assistant/assistant-math';
import { assistantMemory } from '@personal-assistant/assistant-memory';
import { assistantSkills } from '@personal-assistant/assistant-skills';
import { qeekLanguages } from '@qeek/qeek-languages';
import { qeekSysinfo } from '@qeek/qeek-sysinfo';
import { qeekSearch } from '@qeek/qeek-search';
import { qeekScheduler } from '@qeek/qeek-scheduler';
import { qeekSecscan } from '@qeek/qeek-secscan';
import { qeekHealth } from '@qeek/qeek-health';
import { qeekGraph } from '@qeek/qeek-graph';
import { qeekDocgen } from '@qeek/qeek-docgen';
import { qeekCodeAnalysis } from '@qeek/qeek-code-analysis';
import { qeekCapability } from '@qeek/qeek-capability';

/**
 * The default tool-bearing plugin set. Config-only plugins (agent loop,
 * session, presets, guard policies, ...) are intentionally not mounted:
 * this host implements its own loop; upstream Cordis parity is future work.
 */
export const defaultPlugins = [
  assistantCore,
  assistantMath,
  assistantMemory,
  assistantSkills,
  qeekLanguages,
  qeekSysinfo,
  qeekSearch,
  qeekScheduler,
  qeekSecscan,
  qeekHealth,
  qeekGraph,
  qeekDocgen,
  qeekCodeAnalysis,
  qeekCapability,
];

/** Boot the host, mount the default plugins, and start the REPL. */
export async function boot(): Promise<void> {
  const host = new QeekHost();
  const agent = host.mount(defaultPlugins as any);
  await runRepl(host, agent);
}

export { QeekHost } from './host.js';
export { runRepl } from './repl.js';
export { chatConfigFromEnv, chat } from './chat.js';
