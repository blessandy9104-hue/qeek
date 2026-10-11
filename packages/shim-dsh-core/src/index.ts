/**
 * LOCAL COMPATIBILITY SHIM for `@deepseek-ai/dsh-core` (qeek).
 *
 * The upstream DeepSeek Harness has NO package called `dsh-core` and NO
 * `definePlugin` helper (real harness plugins are Cordis `{ name, apply }`
 * objects built on `@deepseek-ai/cordis`). This shim exists so that:
 *  - `pnpm install` resolves (workspace has exactly one `dsh-core`),
 *  - `tsc --noEmit` typechecks the qeek plugin authoring convention,
 *  - `tsdown` builds and `vitest` runs against mock contexts.
 *
 * It is deliberately loose (`any`-friendly) under `strict: true` so that
 * destructured tool args and untyped event handlers typecheck.
 *
 * Runtime interop with the real Cordis host is NOT provided here and is
 * tracked as future work. Do not mistake a passing build for runtime parity.
 */

/** Minimal structural type for the qeek plugin context used in tests. */
export interface QeekContext {
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

/** qeek plugin shape (authoring convention, not upstream Cordis). */
export interface QeekPlugin {
  name: string;
  description?: string;
  setup: (ctx: QeekContext) => unknown;
  [key: string]: unknown;
}

/** qeek skill shape (authoring convention). */
export interface QeekSkill {
  name: string;
  description?: string;
  parameters?: unknown;
  execute: (args: any) => unknown;
  [key: string]: unknown;
}

/** qeek tool shape (authoring convention). */
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
export function definePlugin(p: QeekPlugin): QeekPlugin {
  return p;
}

/** Identity helper: returns the skill object unchanged. */
export function defineSkill(s: QeekSkill): QeekSkill {
  return s;
}

/** Minimal host handle (subset used by qeek app entry points). */
export interface QeekHost {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  [key: string]: any;
}

function stubHost(name: string): never {
  throw new Error(
    `[qeek shim] ${name} is a stub: no real Cordis host is wired. ` +
      `Run inside the DeepSeek Harness launcher (dsh) with a qeek profile, ` +
      `or implement host wiring. See docs/adr/001-cordis-plugin-architecture.md.`
  );
}

/** STUB — throws at runtime. Real host wiring is future work. */
export function createDsh(..._args: any[]): QeekHost {
  return stubHost('createDsh');
}

/** STUB — throws at runtime. Real host wiring is future work. */
export function createWebServer(..._args: any[]): QeekHost {
  return stubHost('createWebServer');
}
