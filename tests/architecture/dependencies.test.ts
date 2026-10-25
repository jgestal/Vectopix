import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The dependency rule, checked on every import: dependencies point inwards.
 *
 *   ui ──▶ application ──▶ domain
 *   infrastructure ──▶ application (ports) ──▶ domain
 *
 * The domain is pure (no libraries, no DOM, no React). Use cases reach the
 * outside world only through the ports they declare. Infrastructure
 * implements those ports. The UI talks to use cases, and only the
 * composition roots wire concrete infrastructure in.
 */

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../../src');
type Layer = 'domain' | 'application' | 'infrastructure' | 'ui' | 'i18n' | 'root';

/** Layers each layer may import from (itself included). */
const ALLOWED: Record<Layer, Layer[]> = {
  domain: ['domain'],
  application: ['application', 'domain'],
  infrastructure: ['infrastructure', 'application', 'domain', 'i18n'],
  ui: ['ui', 'application', 'domain', 'i18n'],
  i18n: ['i18n'],
  root: ['root', 'ui', 'application', 'domain', 'infrastructure', 'i18n'],
};

/** Third-party packages each layer may use. */
const PACKAGES: Record<Layer, RegExp> = {
  domain: /^$/,
  application: /^$/,
  infrastructure: /^(vecline|imagetracerjs)(\/|$)/,
  ui: /^(react|react-dom|lucide-react)(\/|$)/,
  i18n: /^(react)(\/|$)/,
  root: /.*/,
};

/** Files allowed to wire infrastructure into the UI. */
const COMPOSITION_ROOTS = ['ui/compositionRoot.ts', 'infrastructure/worker/vector.worker.ts'];

function layerOf(file: string): Layer {
  const top = relative(SRC, file).split('/')[0];
  return (['domain', 'application', 'infrastructure', 'ui', 'i18n'] as const).find((l) => l === top) ?? 'root';
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith('.d.ts') ? [path] : [];
  });
}

function importsOf(file: string): string[] {
  const code = readFileSync(file, 'utf8');
  return [...code.matchAll(/(?:^|\n)\s*(?:import|export)\b[^'";]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|new URL\(\s*['"]([^'"]+)['"]/g)].map(
    (m) => m[1] ?? m[2] ?? m[3]
  );
}

/**
 * Browser APIs the inner layers must not touch (they reach them through
 * ports). Comments are ignored; TextEncoder and other language-level APIs are fine.
 */
const BROWSER_GLOBALS = /\b(document|window|localStorage|sessionStorage|navigator|DOMParser|XMLSerializer|HTMLElement|FileReader|Image|fetch)\b\s*[.(]/;

function browserUse(file: string): string[] {
  const code = readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/'[^'\n]*'|`[^`]*`/g, "''");
  return code.split('\n').flatMap((line) => {
    const m = line.match(BROWSER_GLOBALS);
    return m ? [m[1]] : [];
  });
}

function violations(): string[] {
  const found: string[] = [];
  for (const file of sourceFiles(SRC)) {
    const layer = layerOf(file);
    const name = relative(SRC, file);
    for (const spec of importsOf(file)) {
      if (spec.startsWith('.')) {
        const target = layerOf(resolve(dirname(file), spec));
        const rootWiring = COMPOSITION_ROOTS.includes(name) && target === 'infrastructure';
        if (!ALLOWED[layer].includes(target) && !rootWiring) found.push(`${name} → ${target} (${spec})`);
      } else if (!PACKAGES[layer].test(spec)) {
        found.push(`${name} → package ${spec}`);
      }
    }
    if (layer === 'domain' || layer === 'application') {
      for (const api of browserUse(file)) found.push(`${name} → browser API ${api}`);
    }
  }
  return found;
}

describe('architecture', () => {
  it('keeps every dependency pointing inwards', () => {
    expect(violations()).toEqual([]);
  });
});
