// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';
import { describe, expect, it } from 'vitest';

const DESKTOP_SRC = join(__dirname, '..', '..');
const TERMINAL_DIR = join(DESKTOP_SRC, 'shared', 'components', 'GenericTerminalPanel');
const TERMINAL_ENTRY = join(TERMINAL_DIR, 'index');
const HIGHLIGHT_DIR = join(DESKTOP_SRC, 'features', 'diff', 'lib', 'highlight');
const SKIP_SEGMENTS = new Set(['__tests__', 'node_modules', 'dist']);
const STATIC_IMPORT = /^(?:import|export)\s+(?!type\b)[^;]*?\sfrom\s+['"]([^'"]+)['"]/gm;
const SIDE_EFFECT_IMPORT = /^import\s+['"]([^'"]+)['"]/gm;

type Edge = {
  readonly file: string;
  readonly target: string;
};

const listSources = (dir: string, acc: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    if (SKIP_SEGMENTS.has(entry)) {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      listSources(full, acc);
      continue;
    }
    if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
};

const staticEdges = (): ReadonlyArray<Edge> =>
  listSources(DESKTOP_SRC).flatMap((file) => {
    const source = readFileSync(file, 'utf8');
    const targets = [...source.matchAll(STATIC_IMPORT), ...source.matchAll(SIDE_EFFECT_IMPORT)].map(
      (match) => match[1] ?? '',
    );
    return targets.map((target) => ({ file, target }));
  });

const resolved = ({ file, target }: Edge): string =>
  target.startsWith('.') ? resolve(dirname(file), target) : target;

const label = (edge: Edge) => `${relative(DESKTOP_SRC, edge.file)} -> ${edge.target}`;

describe('lazy boundaries', () => {
  const edges = staticEdges();

  it('keeps xterm inside the terminal panel folder', () => {
    const offenders = edges
      .filter((edge) => edge.target.startsWith('@xterm/') && !edge.file.startsWith(TERMINAL_DIR))
      .map(label);
    expect(offenders).toEqual([]);
  });

  it('reaches the terminal panel only through its lazy wrapper', () => {
    const offenders = edges
      .filter((edge) => {
        if (edge.file.startsWith(TERMINAL_DIR + '/') && !edge.file.endsWith('index.tsx')) {
          return false;
        }
        const target = resolved(edge);
        return target === TERMINAL_ENTRY || target === TERMINAL_DIR;
      })
      .map(label);
    expect(offenders).toEqual([]);
  });

  it('keeps shiki inside the highlight folder and its tokenizer behind a dynamic import', () => {
    const shikiOutside = edges
      .filter((edge) => edge.target.startsWith('shiki') && !edge.file.startsWith(HIGHLIGHT_DIR))
      .map(label);
    const tokenizerStatic = edges
      .filter((edge) => resolved(edge) === join(HIGHLIGHT_DIR, 'tokenize'))
      .filter((edge) => !edge.file.endsWith(join('highlight', 'worker.ts')))
      .map(label);
    expect([...shikiOutside, ...tokenizerStatic]).toEqual([]);
  });

  it('loads the markdown preview of PromptField only through a dynamic import', () => {
    const preview = join(DESKTOP_SRC, 'shared', 'components', 'PromptField', 'PromptPreview');
    const promptField = readFileSync(
      join(DESKTOP_SRC, 'shared', 'components', 'PromptField', 'index.tsx'),
      'utf8',
    );
    const offenders = edges.filter((edge) => resolved(edge) === preview).map(label);
    expect(offenders).toEqual([]);
    expect(promptField).toMatch(/lazy\(\(\) =>\s*import\('\.\/PromptPreview'\)/);
  });

  it('loads the mock scenes only through a dynamic import from main', () => {
    const offenders = edges
      .filter((edge) => edge.file === join(DESKTOP_SRC, 'main.tsx'))
      .filter((edge) => edge.target.includes('MockScene'))
      .map(label);
    expect(offenders).toEqual([]);
  });
});
