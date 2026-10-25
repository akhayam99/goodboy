// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, relative, sep } from 'path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import {
  IS_UPDATING,
  grownEntries,
  readBaseline,
  writeBaseline,
  type FileCounts,
} from './scanControls';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..');
const TYPES_SRC = join(REPO_ROOT, 'packages', 'types', 'src');
const BASELINE_FILE = 'types-function-bodies.baseline.json';

const EXEMPT_FILES: ReadonlySet<string> = new Set(['packages/types/src/brandId.ts']);
const SKIPPED_FOLDERS: ReadonlyArray<string> = [
  'packages/types/src/testing/',
  'packages/types/src/helpers/',
];

type TextParams = {
  readonly text: string;
};

const countFunctionBodies = ({ text }: TextParams): number => {
  const source = ts.createSourceFile('types.ts', text, ts.ScriptTarget.Latest, true);
  let count = 0;
  const visit = (node: ts.Node): void => {
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isGetAccessorDeclaration(node) ||
      ts.isSetAccessorDeclaration(node)
    ) {
      if (node.type !== undefined && ts.isTypePredicateNode(node.type)) {
        return;
      }
      count += 1;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return count;
};

const walk = ({ directory }: { readonly directory: string }): ReadonlyArray<string> =>
  existsSync(directory)
    ? readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
          ? walk({ directory: join(directory, entry.name) })
          : [join(directory, entry.name)],
      )
    : [];

const measure = (): FileCounts =>
  Object.fromEntries(
    walk({ directory: TYPES_SRC })
      .map((full) => ({ full, path: relative(REPO_ROOT, full).split(sep).join('/') }))
      .filter(({ path }) => /\.ts$/.test(path) && !path.endsWith('.d.ts'))
      .filter(({ path }) => !EXEMPT_FILES.has(path))
      .filter(({ path }) => !SKIPPED_FOLDERS.some((folder) => path.startsWith(folder)))
      .map(
        ({ full, path }) =>
          [path, countFunctionBodies({ text: readFileSync(full, 'utf8') })] as const,
      )
      .filter(([, count]) => count > 0)
      .sort(([left], [right]) => left.localeCompare(right)),
  );

describe('the types package holds types and union guards, not logic', () => {
  it('counts a function body and leaves a union guard alone', () => {
    const text = [
      "export const isMode = (value: unknown): value is 'a' | 'b' => value === 'a' || value === 'b';",
      "export const isKind = (value: unknown): value is 'x' => ['x'].some((entry) => entry === value);",
      'export const parse = ({ value }: { readonly value: unknown }): number => Number(value);',
      'export function build(): string {\n  return String(1);\n}',
    ].join('\n');
    expect(countFunctionBodies({ text })).toBe(2);
  });

  it('finds the files that still hold logic, never an empty sweep', () => {
    expect(Object.keys(measure()).length).toBeGreaterThan(0);
  });

  it('adds no function body beyond the baseline, which only falls', () => {
    const current = measure();
    if (IS_UPDATING) {
      writeBaseline({ file: BASELINE_FILE, counts: current });
      return;
    }
    const grown = grownEntries({ current, baseline: readBaseline({ file: BASELINE_FILE }) });
    const stale = Object.entries(readBaseline({ file: BASELINE_FILE }))
      .filter(([path, allowed]) => (current[path] ?? 0) < allowed)
      .map(([path, allowed]) => `  - ${path}: now ${current[path] ?? 0}, baseline ${allowed}`);
    expect(
      [...grown, ...stale],
      `packages/types holds types and union guards (packages/types/CONVENTIONS.md). A parser, a default or a sentence goes to the package that uses it. Lower the baseline with GOODBOY_UPDATE_BASELINE=1 when a file shrinks.\n${[...grown, ...stale].join('\n')}`,
    ).toEqual([]);
  });
});
