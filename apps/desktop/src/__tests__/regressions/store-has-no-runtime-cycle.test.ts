// @vitest-environment node
import { existsSync, readFileSync } from 'fs';
import { dirname, join, normalize, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const DESKTOP_SRC = join(__dirname, '..', '..');
const ENTRY = 'store/store.ts';
const MODULE_IMPORT =
  /(?:^|\n)[ \t]*(?:import|export)[ \t]+(type[ \t]+)?(\{[^}]*\}|\*(?:[ \t]+as[ \t]+\w+)?|\w+)[ \t]+from[ \t]+'(\.[^']+)'/g;
const SIDE_EFFECT_IMPORT = /(?:^|\n)\s*import\s+'(\.[^']+)'/g;

type ResolveParams = {
  readonly from: string;
  readonly specifier: string;
};

type ImportsParams = {
  readonly path: string;
  readonly text: string;
};

type TextParams = {
  readonly text: string;
};

const resolveModule = ({ from, specifier }: ResolveParams): string | null => {
  const base = normalize(join(dirname(from), specifier));
  const candidates = [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')];
  const found = candidates.find((candidate) => existsSync(join(DESKTOP_SRC, candidate)));
  return found === undefined ? null : found.split(sep).join('/');
};

const isTypeOnlyClause = ({ text }: TextParams): boolean => {
  const clause = text.trim();
  if (!clause.startsWith('{')) {
    return false;
  }
  const names = clause
    .replace(/^\{|\}$/g, '')
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name !== '');
  return names.length > 0 && names.every((name) => name.startsWith('type '));
};

const runtimeImportsOf = ({ path, text }: ImportsParams): ReadonlyArray<string> => {
  const found: string[] = [];
  for (const match of text.matchAll(MODULE_IMPORT)) {
    if (match[1] !== undefined || isTypeOnlyClause({ text: match[2] ?? '' })) {
      continue;
    }
    const target = resolveModule({ from: path, specifier: match[3] ?? '' });
    if (target !== null) {
      found.push(target);
    }
  }
  for (const match of text.matchAll(SIDE_EFFECT_IMPORT)) {
    const target = resolveModule({ from: path, specifier: match[1] ?? '' });
    if (target !== null) {
      found.push(target);
    }
  }
  return found;
};

const isTestSource = (path: string): boolean => /\.test\.tsx?$/.test(path);

const importGraph = (): ReadonlyMap<string, ReadonlyArray<string>> => {
  const graph = new Map<string, ReadonlyArray<string>>();
  const pending = [ENTRY];
  while (pending.length > 0) {
    const path = pending.pop() ?? '';
    if (graph.has(path)) {
      continue;
    }
    const imports = isTestSource(path)
      ? []
      : runtimeImportsOf({ path, text: readFileSync(join(DESKTOP_SRC, path), 'utf8') });
    graph.set(path, imports);
    pending.push(...imports);
  }
  return graph;
};

type ReachParams = {
  readonly graph: ReadonlyMap<string, ReadonlyArray<string>>;
  readonly from: string;
};

const reachable = ({ graph, from }: ReachParams): ReadonlySet<string> => {
  const seen = new Set<string>();
  const pending = [from];
  while (pending.length > 0) {
    const path = pending.pop() ?? '';
    for (const next of graph.get(path) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        pending.push(next);
      }
    }
  }
  return seen;
};

const filesThatImportTheStoreBack = (): ReadonlyArray<string> => {
  const graph = importGraph();
  return [...graph.keys()]
    .filter((path) => path !== ENTRY && reachable({ graph, from: path }).has(ENTRY))
    .sort();
};

describe('the store has no runtime import cycle', () => {
  it('tells a type-only import from a runtime one', () => {
    expect(isTypeOnlyClause({ text: '{ type A, type B }' })).toBe(true);
    expect(isTypeOnlyClause({ text: '{ type A, b }' })).toBe(false);
    expect(isTypeOnlyClause({ text: '{ a }' })).toBe(false);
    expect(isTypeOnlyClause({ text: '* as everything' })).toBe(false);
    expect(
      runtimeImportsOf({
        path: 'store/store.ts',
        text: "import type { A } from './types';\nimport { createUndoSlice } from './slices/undo';",
      }),
    ).toEqual(['store/slices/undo/index.ts']);
  });

  it('follows the store file through its slices, never an empty sweep', () => {
    const graph = importGraph();

    expect(graph.size).toBeGreaterThan(500);
    expect(graph.get(ENTRY)?.length ?? 0).toBeGreaterThan(100);
    expect(relative(DESKTOP_SRC, join(DESKTOP_SRC, ENTRY))).toBe(ENTRY.split('/').join(sep));
  });

  it('lets no file that store.ts loads import store.ts back', () => {
    const cycle = filesThatImportTheStoreBack();

    expect(
      cycle,
      `a slice, and what a slice loads, never imports the store back at runtime, so which ` +
        `module exists first never depends on load order. Move the pure part out of the ` +
        `hook or the component file, or hand the value in through the slice factory ` +
        `(docs/file-system.md, Store slices):\n${cycle.join('\n')}`,
    ).toEqual([]);
  });
});
