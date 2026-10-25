// @vitest-environment node
import { existsSync, readFileSync } from 'fs';
import { dirname, join, normalize } from 'path';
import { describe, expect, it } from 'vitest';
import { DESKTOP_SRC } from '../helpers/sourceImports';

const FROM_SPECIFIER =
  /\bfrom\s+['"](\.{1,2}\/[^'"]*)['"]|(?:^|\n)\s*import\s+['"](\.{1,2}\/[^'"]*)['"]/g;
const TYPE_ONLY_STATEMENT = /(?:^|\n)\s*(?:import|export)\s+type\s[^;]*;/g;
const MOCK_ROOTS: ReadonlyArray<string> = ['app/components/MockScene/', 'test/'];
const SOURCE_SUFFIXES: ReadonlyArray<string> = ['.ts', '.tsx', '/index.ts', '/index.tsx'];

type ResolveParams = {
  readonly from: string;
  readonly specifier: string;
};

type TextParams = {
  readonly text: string;
};

const resolveSource = ({ from, specifier }: ResolveParams): string | null => {
  const base = normalize(join(dirname(from), specifier))
    .split('\\')
    .join('/');
  const found = SOURCE_SUFFIXES.map((suffix) => `${base}${suffix}`).find((candidate) =>
    existsSync(join(DESKTOP_SRC, candidate)),
  );
  return found ?? (existsSync(join(DESKTOP_SRC, base)) ? base : null);
};

const staticSpecifiers = ({ text }: TextParams): ReadonlyArray<string> =>
  [...text.replace(TYPE_ONLY_STATEMENT, '\n').matchAll(FROM_SPECIFIER)].flatMap((match) => {
    const specifier = match[1] ?? match[2];
    return specifier === undefined ? [] : [specifier];
  });

const productionGraph = (): ReadonlySet<string> => {
  const seen = new Set<string>(['main.tsx']);
  const queue: string[] = ['main.tsx'];
  while (queue.length > 0) {
    const from = queue.pop() ?? '';
    if (!/\.tsx?$/.test(from)) {
      continue;
    }
    const text = readFileSync(join(DESKTOP_SRC, from), 'utf8');
    for (const specifier of staticSpecifiers({ text })) {
      const target = resolveSource({ from, specifier });
      if (target !== null && !seen.has(target)) {
        seen.add(target);
        queue.push(target);
      }
    }
  }
  return seen;
};

describe('the production module graph holds no mock code', () => {
  it('reads a static import and not a dynamic one or a type import', () => {
    const text = [
      "import { A } from './a';",
      "import type { B } from './b';",
      "import {\n  C,\n  D,\n} from '../c';",
      "export { E } from './e';",
      "const lazyF = () => import('./f');",
      "import './side';",
    ].join('\n');
    expect(staticSpecifiers({ text })).toEqual(['./a', '../c', './e', './side']);
  });

  it('walks the whole app from main, never an empty sweep', () => {
    const graph = productionGraph();
    expect(graph.size).toBeGreaterThan(1000);
    expect(graph.has('features/workspace-chat/activeChatBackend.ts')).toBe(true);
    expect(graph.has('shared/lib/mockMode.ts')).toBe(true);
  });

  it('keeps the scene chunk, the in-memory backends and the fixtures out of it', () => {
    const offenders = [...productionGraph()].filter(
      (path) =>
        MOCK_ROOTS.some((root) => path.startsWith(root)) ||
        /createMemory(Chat|Ask)Backend/.test(path),
    );
    expect(
      offenders,
      'main.tsx loads the scene chunk with import() and installs the in-memory backends and fixtures from it (app/components/MockScene/installMockRuntime.ts). A static import of mock code from production code puts it in the main bundle.',
    ).toEqual([]);
  });

  it('loads the scene runtime only through a dynamic import', () => {
    const main = readFileSync(join(DESKTOP_SRC, 'main.tsx'), 'utf8');
    expect(main).toContain("import('./app/components/MockScene/installMockRuntime')");
  });
});
