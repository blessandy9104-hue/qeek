import * as readline from 'node:readline';
import * as fs from 'node:fs';
import type { QeekHost } from './host.js';
import { chatConfigFromEnv, chat } from './chat.js';
import { mathcore } from '@personal-assistant/assistant-core/mathcore-mcp';

/** True for the error Node throws when piped stdin ends mid-session. */
function isReadlineClosed(e: unknown): boolean {
  const err = e as { code?: string; message?: string };
  return (
    err?.code === 'ERR_USE_AFTER_CLOSE' || err?.message === 'readline was closed'
  );
}

const MATH_HINT =
  /\b(solve|derivative|integrat|differentiat|determinant|eigenvalu|prime|factor|gcd|lcm|simplify|expand|limit|matrix|statistic|convert|probability)\b/i;

function looksLikeMath(text: string): boolean {
  const t = text.trim();
  if (MATH_HINT.test(t)) return true;
  // bare arithmetic, e.g. "2+2", "(3+4)*5", "10!"
  return /^[0-9\s+\-*/^().!%]+$/.test(t) && /\d/.test(t) && /[+\-*/^!%]/.test(t);
}

const HELP = `qeek commands:
  /help                 show this help
  /tools                list available tools
  /math <expression>    verified computation (mathcore, offline)
  /check <q> ;; <a>     audit a proposed answer against mathcore
  /sys                  host snapshot (OS/CPU/RAM/disk/GPU)
  /caps                 capability summary
  /quit                 exit
Anything else: chat (needs DEEPSEEK_API_KEY) or math when it looks like math.`;

export async function runRepl(host: QeekHost, agent: { systemSections: string[] }): Promise<void> {
  const chatCfg = chatConfigFromEnv();
  const baseSystem = [
    'You are qeek, a personal assistant with verified computation and persistent memory.',
    'For any arithmetic, algebra, calculus, linear algebra, number theory, logic, statistics or unit conversion: do not compute in your head. Call the mathcore tools and state only verified values. If a result is WITHHELD, say so; never guess.',
    ...agent.systemSections,
  ].join('\n\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chatCfg ? 'qeek> ' : 'qeek (tools-only, set DEEPSEEK_API_KEY for chat)> ',
  });

  console.log('qeek — local-first assistant. Type /help for commands, /quit to exit.');
  if (!chatCfg) {
    console.log(
      'No DEEPSEEK_API_KEY set: chat is disabled, but all local tools work ' +
        '(math, memory, sysinfo, languages, search, scheduler, ...).'
    );
  }

  const shutdown = () => {
    try {
      mathcore.stop();
    } catch {
      // already stopped
    }
    try {
      rl.close();
    } catch {
      // already closed
    }
  };
  process.once('SIGINT', () => {
    shutdown();
    process.exit(0);
  });

  let history: any[] = [];

  const handleLine = async (raw: string): Promise<boolean> => {
    const text = raw.trim();
    if (!text) return true;
    try {
      if (text === '/quit' || text === '/exit') return false;
      if (text === '/help') {
        console.log(HELP);
      } else if (text === '/tools') {
        for (const t of host.tools()) {
          console.log(`- ${t.name}  [${t.plugin}]`);
        }
      } else if (text === '/caps') {
        try {
          const caps = await host.runTool('capability_scan', { deep: false });
          const list = caps as any[];
          const ok = list.filter((c: any) => c.status === 'available').length;
          console.log(`${ok}/${list.length} capabilities available`);
        } catch {
          console.log('capability scan unavailable in this profile');
        }
      } else if (text === '/sys') {
        console.log(JSON.stringify(await host.runTool('sysinfo_snapshot', {}), null, 2).slice(0, 2000));
      } else if (text.startsWith('/math ')) {
        console.log(await host.runTool('mathcore_compute', { expression: text.slice(6) }));
      } else if (text.startsWith('/check ')) {
        const rest = text.slice(7);
        const sep = rest.indexOf(';;');
        if (sep < 0) {
          console.log('usage: /check <question> ;; <proposed answer>');
        } else {
          console.log(
            await host.runTool('mathcore_check_answer', {
              question: rest.slice(0, sep).trim(),
              answer: rest.slice(sep + 2).trim(),
            })
          );
        }
      } else if (looksLikeMath(text)) {
        console.log(await host.runTool('mathcore_compute', { expression: text }));
      } else if (chatCfg) {
        history = await chat(host, chatCfg, baseSystem, history, text, (kind, out) => {
          console.log(kind === 'tool' ? `  [tool ${out}]` : out);
        });
      } else {
        console.log(
          'That looks like a chat request, but no model is configured.\n' +
            'Set DEEPSEEK_API_KEY (or QEEK_API_BASE for a local OpenAI-compatible server) to enable chat.\n' +
            'Meanwhile try: /math 2+2 · /sys · /tools · /help'
        );
      }
    } catch (e) {
      console.log(`error: ${e instanceof Error ? e.message : String(e)}`);
    }
    return true;
  };

  if (!process.stdin.isTTY) {
    // Batch mode (piped stdin): drain the whole stream before processing.
    // readline discards buffered lines when EOF arrives mid-tool-call, so
    // the async iterator is only safe for interactive TTYs.
    const data = fs.readFileSync(0, 'utf-8');
    for (const raw of data.split(/\r?\n/)) {
      const cont = await handleLine(raw);
      if (!cont) break;
    }
    shutdown();
    return;
  }

  rl.prompt();
  try {
    for await (const line of rl) {
      const cont = await handleLine(line);
      if (!cont) break;
      rl.prompt();
    }
  } catch (e) {
    // Piped stdin ended while a tool call was in flight: the readline
    // iterator throws. That is a clean EOF, not a failure.
    if (!isReadlineClosed(e)) throw e;
  } finally {
    shutdown();
  }
}
