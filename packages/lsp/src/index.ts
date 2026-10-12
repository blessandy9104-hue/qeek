import { definePlugin } from '@deepseek-ai/dsh-core';

export const zoveliLSP = definePlugin({
  name: 'zoveli-lsp',
  description: 'Language Server Protocol integration',

  setup(ctx) {
    ctx.register('lsp-servers', {
      typescript: {
        command: 'npx',
        args: ['typescript-language-server', '--stdio'],
        languages: ['typescript', 'javascript', 'tsx', 'jsx'],
        initializationOptions: { preferences: { includeCompletionsForModuleExports: true } }
      },
      python: {
        command: 'pylsp',
        args: [],
        languages: ['python'],
        initializationOptions: { pylsp: { plugins: { pycodestyle: { enabled: true }, pyflakes: { enabled: true } } } }
      },
      rust: {
        command: 'rust-analyzer',
        args: [],
        languages: ['rust'],
        initializationOptions: {}
      },
      go: {
        command: 'gopls',
        args: [],
        languages: ['go'],
        initializationOptions: {}
      },
      json: {
        command: 'vscode-json-language-server',
        args: ['--stdio'],
        languages: ['json', 'jsonc'],
        initializationOptions: {}
      }
    });

    ctx.register('lsp-config', {
      autoStart: true,
      maxServers: 10,
      timeout: 30000,
      trace: 'off',
      workspaceFolders: [process.cwd()]
    });

    ctx.register('lsp-tools', [
      {
        name: 'lsp_hover',
        description: 'Get hover information',
        parameters: {
          type: 'object',
          properties: { uri: { type: 'string' }, line: { type: 'number' }, character: { type: 'number' } },
          required: ['uri', 'line', 'character']
        }
      },
      {
        name: 'lsp_definition',
        description: 'Go to definition',
        parameters: {
          type: 'object',
          properties: { uri: { type: 'string' }, line: { type: 'number' }, character: { type: 'number' } },
          required: ['uri', 'line', 'character']
        }
      },
      {
        name: 'lsp_references',
        description: 'Find references',
        parameters: {
          type: 'object',
          properties: { uri: { type: 'string' }, line: { type: 'number' }, character: { type: 'number' } },
          required: ['uri', 'line', 'character']
        }
      },
      {
        name: 'lsp_diagnostics',
        description: 'Get diagnostics for file',
        parameters: {
          type: 'object',
          properties: { uri: { type: 'string' } },
          required: ['uri']
        }
      },
      {
        name: 'lsp_completion',
        description: 'Get completions',
        parameters: {
          type: 'object',
          properties: { uri: { type: 'string' }, line: { type: 'number' }, character: { type: 'number' } },
          required: ['uri', 'line', 'character']
        }
      },
      {
        name: 'lsp_rename',
        description: 'Rename symbol',
        parameters: {
          type: 'object',
          properties: { uri: { type: 'string' }, line: { type: 'number' }, character: { type: 'number' }, newName: { type: 'string' } },
          required: ['uri', 'line', 'character', 'newName']
        }
      }
    ]);
  }
});

export default zoveliLSP;

