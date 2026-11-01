import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(import.meta.dirname, '../../src');
const SPEC = join(import.meta.dirname, '../../../docs/openapi.yaml');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
  });
}
const rel = (p: string) => relative(SRC, p);
const importsOf = (p: string) => [...readFileSync(p, 'utf8').matchAll(/from\s+'(\.[^']*)'/g)].map((m) => m[1]!);
const moduleOf = (p: string) => /^modules\/([^/]+)\//.exec(rel(p).replaceAll('\\', '/'))?.[1];

describe('architecture', () => {
  it('shared code never imports from a module', () => {
    const bad = files(join(SRC, 'shared')).filter((f) => importsOf(f).some((i) => /(^|\/)modules\//.test(i)));
    expect(bad.map(rel)).toEqual([]);
  });

  it('a module never imports another module (use events or an exported service wired in app.ts)', () => {
    const bad: string[] = [];
    for (const f of files(join(SRC, 'modules'))) {
      const own = moduleOf(f);
      for (const i of importsOf(f)) {
        const target = /modules\/([^/]+)\//.exec(i)?.[1] ?? (i.startsWith('../') && !i.includes('shared') && !i.includes('config') ? /^\.\.\/([^/]+)\//.exec(i)?.[1] : undefined);
        if (target && target !== own && target !== 'shared' && target !== 'config' && target !== 'db' && target !== '..' && target !== '.') bad.push(`${rel(f)} -> ${i}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('every /api/v1 route is documented in docs/openapi.yaml, and the spec has no ghost routes', () => {
    const code = new Set<string>();
    for (const f of files(SRC)) {
      for (const m of readFileSync(f, 'utf8').matchAll(/app\.(get|post|put|patch|delete)\(\s*'(\/(?:api\/v1|health)[^']*)'/g)) {
        code.add(`${m[1]!.toUpperCase()} ${m[2]!.replace(/:(\w+)/g, '{$1}')}`);
      }
    }
    const spec = new Set<string>();
    let path = '';
    for (const line of readFileSync(SPEC, 'utf8').split('\n')) {
      const p = /^ {2}(\/\S+):\s*$/.exec(line);
      if (p) path = p[1]!;
      const v = /^ {4}(get|post|put|patch|delete):\s*$/.exec(line);
      if (v && path) spec.add(`${v[1]!.toUpperCase()} ${path}`);
    }
    expect([...code].filter((r) => !spec.has(r))).toEqual([]);
    expect([...spec].filter((r) => !code.has(r))).toEqual([]);
  });
});
