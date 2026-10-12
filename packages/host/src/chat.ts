import type { ZoveliHost } from './host.js';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: {
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }[];
  tool_call_id?: string;
  name?: string;
}

export interface ChatConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  maxSteps?: number;
}

/**
 * Read chat configuration from the environment. Null when not configured.
 * Any OpenAI-compatible endpoint works, e.g. ZOVELI_API_BASE=http://localhost:11434/v1
 * for a local Ollama server (some local servers accept any non-empty key).
 */
export function chatConfigFromEnv(): ChatConfig | null {
  const apiKey = process.env.DEEPSEEK_API_KEY || '';
  if (!apiKey) return null;
  const baseUrl = (process.env.ZOVELI_API_BASE || 'https://api.deepseek.com').replace(
    /\/chat\/completions\/?$/,
    ''
  );
  return {
    apiKey,
    baseUrl,
    model: process.env.ZOVELI_MODEL || 'deepseek-chat',
    maxSteps: 10,
  };
}

function toFunctionTool(t: { name: string; description?: string; parameters?: unknown }) {
  return {
    type: 'function' as const,
    function: {
      name: t.name,
      description: (t.description || '').slice(0, 500),
      parameters: (t.parameters as any) || { type: 'object', properties: {} },
    },
  };
}

function safeJsonParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

/**
 * Minimal agentic loop over an OpenAI-compatible chat-completions endpoint
 * (DeepSeek API, Ollama, or anything speaking the same protocol).
 */
export async function chat(
  host: ZoveliHost,
  cfg: ChatConfig,
  systemPrompt: string,
  history: ChatMessage[],
  userText: string,
  onEvent: (kind: 'text' | 'tool', text: string) => void
): Promise<ChatMessage[]> {
  const tools = host.tools().map(toFunctionTool);
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userText },
  ];
  const steps = cfg.maxSteps ?? 10;

  for (let step = 0; step < steps; step++) {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        tools: tools.length > 0 ? tools : undefined,
        temperature: 0.7,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`chat API error ${res.status}: ${body.slice(0, 300)}`);
    }
    const data: any = await res.json();
    const choice = data.choices?.[0]?.message;
    if (!choice) throw new Error('chat API returned no choices');
    messages.push({
      role: 'assistant',
      content: choice.content ?? null,
      tool_calls: choice.tool_calls,
    });

    const calls = choice.tool_calls ?? [];
    if (calls.length === 0) {
      if (choice.content) onEvent('text', choice.content);
      return messages.slice(1); // drop system before returning to history
    }
    for (const call of calls) {
      const name = call.function?.name ?? '?';
      const args = safeJsonParse(call.function?.arguments ?? '{}');
      onEvent('tool', `@${name}`);
      let result: string;
      try {
        const out = await host.runTool(name, args);
        result = typeof out === 'string' ? out : JSON.stringify(out);
      } catch (e) {
        result = `tool error: ${e instanceof Error ? e.message : String(e)}`;
      }
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: result.slice(0, 8000),
      });
    }
  }
  onEvent('text', '(stopped after max tool steps)');
  return messages.slice(1);
}

