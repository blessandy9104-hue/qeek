import * as path from 'path';
import type { LanguageInfo, DetectionResult } from './types';

const LANGUAGES: LanguageInfo[] = [
  {
    name: 'typescript', displayName: 'TypeScript',
    extensions: ['.ts', '.tsx', '.mts', '.cts'],
    filenames: [], mimeTypes: ['application/typescript'],
    category: 'programming', paradigms: ['object-oriented', 'functional'],
    version: '5.3', tooling: { lsp: 'typescript-language-server', formatter: 'prettier', linter: 'eslint', testRunner: 'vitest', packageManager: 'pnpm', buildTool: 'tsc' },
  },
  {
    name: 'javascript', displayName: 'JavaScript',
    extensions: ['.js', '.jsx', '.mjs', '.cjs'],
    filenames: [], mimeTypes: ['application/javascript'],
    category: 'programming', paradigms: ['object-oriented', 'functional', 'imperative'],
    version: 'ES2022', tooling: { lsp: 'typescript-language-server', formatter: 'prettier', linter: 'eslint', testRunner: 'vitest', packageManager: 'pnpm' },
  },
  {
    name: 'python', displayName: 'Python',
    extensions: ['.py', '.pyi', '.pyw'], filenames: [],
    mimeTypes: ['text/x-python'], category: 'programming',
    paradigms: ['object-oriented', 'imperative', 'functional'],
    version: '3.11', tooling: { lsp: 'pylsp', formatter: 'black', linter: 'ruff', testRunner: 'pytest', packageManager: 'pip' },
  },
  {
    name: 'rust', displayName: 'Rust',
    extensions: ['.rs'], filenames: [],
    mimeTypes: ['text/rust'], category: 'programming',
    paradigms: ['imperative', 'functional', 'concurrent'],
    version: '1.75', tooling: { lsp: 'rust-analyzer', formatter: 'rustfmt', linter: 'clippy', testRunner: 'cargo test', packageManager: 'cargo', buildTool: 'cargo' },
  },
  {
    name: 'go', displayName: 'Go',
    extensions: ['.go'], filenames: [],
    mimeTypes: ['text/x-go'], category: 'programming',
    paradigms: ['imperative', 'concurrent', 'procedural'],
    version: '1.22', tooling: { lsp: 'gopls', formatter: 'gofmt', linter: 'golangci-lint', testRunner: 'go test', packageManager: 'go mod' },
  },
  {
    name: 'java', displayName: 'Java',
    extensions: ['.java'], filenames: [],
    mimeTypes: ['text/x-java'], category: 'programming',
    paradigms: ['object-oriented', 'imperative'],
    version: '21', tooling: { lsp: 'jdtls', formatter: 'google-java-format', linter: 'checkstyle', testRunner: 'junit', packageManager: 'maven', buildTool: 'maven' },
  },
  {
    name: 'cpp', displayName: 'C++',
    extensions: ['.cpp', '.cc', '.cxx', '.h', '.hpp', '.c'],
    filenames: [], mimeTypes: ['text/x-c++src'],
    category: 'programming', paradigms: ['object-oriented', 'procedural'],
    version: 'C++20', tooling: { lsp: 'clangd', formatter: 'clang-format', linter: 'clang-tidy', testRunner: 'ctest', buildTool: 'cmake' },
  },
  {
    name: 'csharp', displayName: 'C#',
    extensions: ['.cs'], filenames: [],
    mimeTypes: ['text/x-csharp'], category: 'programming',
    paradigms: ['object-oriented', 'functional'],
    version: '12', tooling: { lsp: 'omnisharp', formatter: 'dotnet format', linter: 'roslyn', testRunner: 'dotnet test', packageManager: 'nuget' },
  },
  {
    name: 'ruby', displayName: 'Ruby',
    extensions: ['.rb'], filenames: ['Gemfile', 'Rakefile'],
    mimeTypes: ['text/x-ruby'], category: 'scripting',
    paradigms: ['object-oriented', 'imperative'],
    version: '3.3', tooling: { lsp: 'solargraph', formatter: 'rubocop', linter: 'rubocop', testRunner: 'rspec', packageManager: 'bundler' },
  },
  {
    name: 'php', displayName: 'PHP',
    extensions: ['.php'], filenames: [],
    mimeTypes: ['application/x-php'], category: 'scripting',
    paradigms: ['object-oriented', 'imperative'],
    version: '8.3', tooling: { lsp: 'intelephense', formatter: 'php-cs-fixer', linter: 'phpstan', testRunner: 'phpunit', packageManager: 'composer' },
  },
  {
    name: 'html', displayName: 'HTML',
    extensions: ['.html', '.htm'], filenames: [],
    mimeTypes: ['text/html'], category: 'markup',
    paradigms: ['declarative'], version: '5',
    tooling: { lsp: 'vscode-html-language-server', formatter: 'prettier' },
  },
  {
    name: 'css', displayName: 'CSS',
    extensions: ['.css', '.scss', '.less'], filenames: [],
    mimeTypes: ['text/css'], category: 'markup',
    paradigms: ['declarative'], version: '3',
    tooling: { lsp: 'vscode-css-language-server', formatter: 'prettier', linter: 'stylelint' },
  },
  {
    name: 'json', displayName: 'JSON',
    extensions: ['.json', '.jsonc'], filenames: [],
    mimeTypes: ['application/json'], category: 'data',
    paradigms: ['declarative'], version: '1',
    tooling: { lsp: 'vscode-json-language-server', formatter: 'prettier' },
  },
  {
    name: 'yaml', displayName: 'YAML',
    extensions: ['.yaml', '.yml'], filenames: [],
    mimeTypes: ['application/yaml'], category: 'config',
    paradigms: ['declarative'], version: '1.2',
    tooling: { lsp: 'yaml-language-server', formatter: 'prettier', linter: 'yamllint' },
  },
  {
    name: 'markdown', displayName: 'Markdown',
    extensions: ['.md', '.markdown'], filenames: [],
    mimeTypes: ['text/markdown'], category: 'markup',
    paradigms: ['declarative'], version: '1',
    tooling: { formatter: 'prettier', linter: 'markdownlint' },
  },
  {
    name: 'bash', displayName: 'Bash',
    // NOTE: Dockerfile/Makefile intentionally NOT mapped here — they are
    // their own DSLs, not bash. They resolve to 'unknown' unless content
    // heuristics (e.g. a bash shebang) say otherwise.
    extensions: ['.sh', '.bash'], filenames: [],
    mimeTypes: ['application/x-sh'], category: 'scripting',
    paradigms: ['imperative'], version: '5.2',
    tooling: { lsp: 'bash-language-server', formatter: 'shfmt', linter: 'shellcheck' },
  },
  {
    name: 'sql', displayName: 'SQL',
    extensions: ['.sql'], filenames: [],
    mimeTypes: ['application/sql'], category: 'query',
    paradigms: ['declarative'], version: '2016',
    tooling: { lsp: 'sqls', formatter: 'sqlfluff', linter: 'sqlfluff' },
  },
];

export class LanguageDetector {
  private extMap = new Map<string, LanguageInfo>();
  private fileMap = new Map<string, LanguageInfo>();

  constructor() {
    for (const lang of LANGUAGES) {
      for (const ext of lang.extensions) this.extMap.set(ext.toLowerCase(), lang);
      for (const fn of lang.filenames) this.fileMap.set(fn.toLowerCase(), lang);
    }
  }

  getSupportedLanguages(): LanguageInfo[] {
    return [...LANGUAGES];
  }

  detect(filePath: string, content?: string): DetectionResult {
    const base = path.basename(filePath).toLowerCase();
    const ext = path.extname(base).toLowerCase();

    // 1. filename match
    const byFile = this.fileMap.get(base);
    if (byFile) {
      return { language: byFile.name, confidence: 0.95, method: 'filename', alternatives: [] };
    }

    // 2. extension match
    const byExt = this.extMap.get(ext);
    // 3. shebang / content sniffing
    const sniffed = content ? this.sniffContent(content) : null;

    if (byExt && sniffed && byExt.name !== sniffed.language) {
      // mixed signals — prefer extension but list alternative
      return {
        language: byExt.name,
        confidence: 0.75,
        method: 'mixed',
        alternatives: [{ language: sniffed.language, confidence: sniffed.confidence * 0.8 }],
      };
    }

    if (byExt) {
      return { language: byExt.name, confidence: 0.9, method: 'extension', alternatives: [] };
    }

    if (sniffed) return sniffed;

    return { language: 'unknown', confidence: 0, method: 'content', alternatives: [] };
  }

  private sniffContent(content: string): DetectionResult | null {
    const head = content.slice(0, 2000);

    if (/^#!.*\b(python3?|python)\b/m.test(head)) {
      return { language: 'python', confidence: 0.9, method: 'shebang', alternatives: [] };
    }
    if (/^#!.*\b(bash|sh)\b/m.test(head)) {
      return { language: 'bash', confidence: 0.9, method: 'shebang', alternatives: [] };
    }
    if (/^#!.*\bnode\b/m.test(head)) {
      return { language: 'javascript', confidence: 0.85, method: 'shebang', alternatives: [] };
    }
    // heuristics
    if (/\bimport\s+.*from\s+['"]|export\s+(default\s+)?(function|const|class)|:\s*(string|number|boolean)\b/.test(head)) {
      return { language: 'typescript', confidence: 0.6, method: 'content', alternatives: [{ language: 'javascript', confidence: 0.4 }] };
    }
    if (/\bdef\s+\w+\s*\(.*\):|\bimport\s+\w+\s*$|print\(/.test(head)) {
      return { language: 'python', confidence: 0.6, method: 'content', alternatives: [] };
    }
    if (/\bfn\s+\w+\s*\(|let\s+mut\s+\w+|impl\s+\w+/.test(head)) {
      return { language: 'rust', confidence: 0.6, method: 'content', alternatives: [] };
    }
    if (/^\s*package\s+\w+|^\s*func\s+\w+\s*\(/.test(head)) {
      return { language: 'go', confidence: 0.6, method: 'content', alternatives: [] };
    }
    return null;
  }
}
