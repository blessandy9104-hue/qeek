import { createDsh, createWebServer } from '@deepseek-ai/dsh-core';
import { assistantCore } from '@personal-assistant/assistant-core';
import { assistantMath } from '@personal-assistant/assistant-math';
import { assistantMemory } from '@personal-assistant/assistant-memory';
import { assistantSkills } from '@personal-assistant/assistant-skills';

async function main() {
  const dsh = await createDsh({
    profile: 'personal-assistant-web',
    plugins: [
      assistantCore,
      assistantMath,
      assistantMemory,
      assistantSkills
    ],
    config: {
      vaultPath: process.env.ASSISTANT_VAULT_PATH || './knowledge-vault',
      mathcoreAuditPath: process.env.MATHCORE_AUDIT || '~/.mathcore/audit.jsonl',
      webPort: process.env.PORT || 3080
    }
  });

  const server = await createWebServer(dsh, {
    port: parseInt(process.env.PORT || '3080'),
    host: '127.0.0.1'
  });

  await dsh.start();
  await server.start();
  
  console.log(`Personal Assistant Web UI running at http://127.0.0.1:${process.env.PORT || 3080}`);
  
  process.on('SIGINT', async () => {
    await server.stop();
    await dsh.stop();
    process.exit(0);
  });
}

main().catch(console.error);