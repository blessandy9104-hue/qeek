import { definePlugin } from '@deepseek-ai/dsh-core';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * qeek-docgen: generate Markdown API docs from source files without
 * requiring a full TypeDoc install. Deterministic and offline.
 */
export const qeekDocgen = definePlugin({
  name: 'qeek-docgen',
  description: 'Generate Markdown docs from code exports',

  setup(ctx) {
    async function generateForFile(filePath: string, content?: string): Promise<string> {
      if (!content) content = await fs.readFile(filePath, 'utf-8');
      const base = path.basename(filePath);
      const out: string[] = [`# ${base}`, '', `Source: \`${filePath}\``, ''];
      const exportRe = /^export\s+(?:async\s+)?(?:function|class|const|interface|type|enum)\s+(\w+)/gm;
      let m: RegExpExecArray | null;
      let count = 0;
      while ((m = exportRe.exec(content)) !== null) {
        count++;
        out.push(`## ${m[1]}`, '', `Defined in \`${base}\`.`, '');
      }
      if (count === 0) out.push('_No exports found._', '');
      return out.join('\n');
    }

    async function generateForDir(dir: string, outDir: string): Promise<string[]> {
      await fs.mkdir(outDir, { recursive: true });
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const written: string[] = [];
      for (const e of entries) {
        if (e.isFile() && /\.(ts|js|py)$/.test(e.name)) {
          const full = path.join(dir, e.name);
          const md = await generateForFile(full);
          const dest = path.join(outDir, `${e.name}.md`);
          await fs.writeFile(dest, md, 'utf-8');
          written.push(dest);
        }
      }
      return written;
    }

    ctx.provide('docgen', { generateForFile, generateForDir });

    ctx.register('docgen-tools', [
      {
        name: 'docs_generate',
        description: 'Generate Markdown docs for a source file or directory',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            outDir: { type: 'string' },
          },
          required: ['path'],
        },
        async execute({ path: p, outDir }: { path: string; outDir?: string }) {
          const stat = await fs.stat(p);
          if (stat.isDirectory()) {
            const dest = outDir ?? path.join(p, 'docs-generated');
            return { files: await generateForDir(p, dest) };
          }
          return { markdown: await generateForFile(p) };
        },
      },
    ]);
  },
});

export default qeekDocgen;
