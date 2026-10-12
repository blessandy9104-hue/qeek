import { execFile } from 'child_process';
import { promisify } from 'util';
import type { LanguageToolingInfo } from './types';
import { LanguageDetector } from './detector';

const execFileAsync = promisify(execFile);

const TOOLING_DB: Record<string, LanguageToolingInfo & { installHints: Record<string, string> }> = {
  typescript: {
    lsp: 'typescript-language-server', formatter: 'prettier', linter: 'eslint',
    testRunner: 'vitest', packageManager: 'pnpm', buildTool: 'tsc',
    installHints: {
      lsp: 'npm i -g typescript-language-server typescript',
      formatter: 'npm i -D prettier',
      linter: 'npm i -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin',
      testRunner: 'npm i -D vitest',
    },
  },
  javascript: {
    lsp: 'typescript-language-server', formatter: 'prettier', linter: 'eslint',
    testRunner: 'vitest', packageManager: 'pnpm',
    installHints: {
      lsp: 'npm i -g typescript-language-server typescript',
      formatter: 'npm i -D prettier',
      linter: 'npm i -D eslint',
      testRunner: 'npm i -D vitest',
    },
  },
  python: {
    lsp: 'pylsp', formatter: 'black', linter: 'ruff',
    testRunner: 'pytest', packageManager: 'pip',
    installHints: {
      lsp: 'pip install python-lsp-server',
      formatter: 'pip install black',
      linter: 'pip install ruff',
      testRunner: 'pip install pytest',
    },
  },
  rust: {
    lsp: 'rust-analyzer', formatter: 'rustfmt', linter: 'clippy',
    testRunner: 'cargo test', packageManager: 'cargo', buildTool: 'cargo',
    installHints: {
      lsp: 'rustup component add rust-analyzer',
      formatter: 'rustup component add rustfmt',
      linter: 'rustup component add clippy',
      testRunner: 'cargo test (built-in)',
    },
  },
  go: {
    lsp: 'gopls', formatter: 'gofmt', linter: 'golangci-lint',
    testRunner: 'go test', packageManager: 'go mod',
    installHints: {
      lsp: 'go install golang.org/x/tools/gopls@latest',
      formatter: 'gofmt (built-in)',
      linter: 'go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest',
      testRunner: 'go test ./... (built-in)',
    },
  },
  java: {
    lsp: 'jdtls', formatter: 'google-java-format', linter: 'checkstyle',
    testRunner: 'mvn test', packageManager: 'maven', buildTool: 'maven',
    installHints: { lsp: 'see https://github.com/eclipse-jdtls/eclipse.jdt.ls', formatter: 'mvn com.coveo:fmt-maven-plugin:format', linter: 'mvn checkstyle:check', testRunner: 'mvn test' },
  },
  bash: {
    lsp: 'bash-language-server', formatter: 'shfmt', linter: 'shellcheck',
    installHints: { lsp: 'npm i -g bash-language-server', formatter: 'go install mvdan.cc/sh/v3/cmd/shfmt@latest', linter: 'apt install shellcheck / brew install shellcheck' },
  },
};

export class LanguageTooling {
  private ctx: any;
  private detector = new LanguageDetector();

  constructor(ctx: any) {
    this.ctx = ctx;
  }

  async getForLanguage(language: string): Promise<{
    language: string;
    tooling: LanguageToolingInfo;
    installHints: Record<string, string>;
    availability: Record<string, boolean>;
  }> {
    const key = language.toLowerCase();
    const entry = TOOLING_DB[key];
    if (!entry) {
      const detected = this.detector.getSupportedLanguages().find((l) => l.name === key);
      return {
        language: key,
        tooling: detected?.tooling ?? {},
        installHints: {},
        availability: {},
      };
    }
    const { installHints, ...tooling } = entry;
    const availability: Record<string, boolean> = {};
    for (const [kind, bin] of Object.entries({
      lsp: tooling.lsp?.split(' ')[0],
      formatter: tooling.formatter?.split(' ')[0],
      linter: tooling.linter?.split(' ')[0],
      testRunner: tooling.testRunner?.split(' ')[0],
    })) {
      if (!bin) continue;
      availability[kind] = await this.commandExists(bin);
    }
    return { language: key, tooling, installHints, availability };
  }

  private async commandExists(cmd: string): Promise<boolean> {
    // npx-provided tools count as available via npx fallback
    if (['prettier', 'eslint', 'vitest', 'typescript-language-server'].includes(cmd)) return true;
    try {
      const checker = process.platform === 'win32' ? 'where' : 'which';
      await execFileAsync(checker, [cmd], { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
}
