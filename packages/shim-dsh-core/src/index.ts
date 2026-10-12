/**
 * LOCAL COMPATIBILITY SHIM for `@deepseek-ai/dsh-core` (Zoveli).
 *
 * The upstream DeepSeek Harness has NO package called `dsh-core` and NO
 * `definePlugin` helper (real harness plugins are Cordis `{ name, apply }`
 * objects built on `@deepseek-ai/cordis`). This shim exists so that:
 *  - `pnpm install` resolves (workspace has exactly one `dsh-core`),
 *  - `tsc --noEmit` typechecks the Zoveli plugin authoring convention,
 *  - `tsdown` builds and `vitest` runs against mock contexts.
 *
 * It is deliberately loose (`any`-friendly) under `strict: true` so that
 * destructured tool args and untyped event handlers typecheck.
 *
 * Runtime interop with the real Cordis host is NOT provided here and is
 * tracked as future work. Do not mistake a passing build for runtime parity.
 */

/** Minimal structural type for the Zoveli plugin context used in tests. */
export interface ZoveliContext {
  register: (key: string, value?: any, ...rest: any[]) => any;
  provide: (key: string, value?: any, ...rest: any[]) => any;
  on: (event: string, handler: (payload?: any, ...rest: any[]) => any, ...rest: any[]) => any;
  emit?: (event: string, ...args: any[]) => any;
  get?: (key: string, ...args: any[]) => any;
  log?: any;
  config?: any;
  plugins?: any[];
  [key: string]: any;
}

/** Zoveli plugin shape (authoring convention, not upstream Cordis). */
export interface ZoveliPlugin {
  name: string;
  description?: string;
  setup: (ctx: ZoveliContext) => unknown;
  [key: string]: unknown;
}

/** Zoveli skill shape (authoring convention). */
export interface ZoveliSkill {
  name: string;
  description?: string;
  parameters?: unknown;
  execute: (args: any) => unknown;
  [key: string]: unknown;
}

/** Zoveli tool shape (authoring convention). */
export interface Tool {
  name: string;
  description?: string;
  parameters?: unknown;
  // `this: any` because tool implementations call sibling helpers
  // (e.g. `this.callMCP(...)`) on the enclosing tool-table object.
  execute: (this: any, args: any) => unknown;
  [key: string]: unknown;
}

/** Identity helper: returns the plugin object unchanged. */
export function definePlugin(p: ZoveliPlugin): ZoveliPlugin {
  return p;
}

/** Identity helper: returns the skill object unchanged. */
export function defineSkill(s: ZoveliSkill): ZoveliSkill {
  return s;
}

/** Minimal host handle (subset used by Zoveli app entry points). */
export interface ZoveliHost {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  [key: string]: any;
}

function stubHost(name: string): never {
  throw new Error(
    `[zoveli shim] ${name} is a stub: no real Cordis host is wired. ` +
      `Run inside the DeepSeek Harness launcher (dsh) with a Zoveli profile, ` +
      `or implement host wiring. See docs/adr/001-cordis-plugin-architecture.md.`
  );
}

/** STUB — throws at runtime. Real host wiring is future work. */
export function createDsh(..._args: any[]): ZoveliHost {
  return stubHost('createDsh');
}

/** STUB — throws at runtime. Real host wiring is future work. */
export function createWebServer(..._args: any[]): ZoveliHost {
  return stubHost('createWebServer');
}



