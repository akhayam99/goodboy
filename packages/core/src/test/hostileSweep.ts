import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const HOSTILE_LENGTH = 100_000;

export const HOSTILE_BUDGET_MS = 200;

const SRC_ROOT = fileURLToPath(new URL('../', import.meta.url));

const EXPORTED_NAME = /^export (?:const|function) (\w+)/gm;

const HELPER_KEYWORD = /parse|slug|sanitiz|sanitis|normaliz|strip/i;

const TEST_FILE = /\.(?:test|perf\.test|d)\.tsx?$/;

const SKIPPED_FOLDERS: ReadonlyArray<string> = ['__tests__', 'test', 'node_modules'];

const HOSTILE_UNITS: ReadonlyArray<string> = [
  ' ',
  '\t',
  '\n',
  'a',
  '1.',
  '!',
  '`',
  '{',
  '[',
  '"',
  '\\',
  '-',
  '/',
  '-="',
];

export type HostileHelper = Readonly<{
  name: string;
  file: string;
  fn: (...args: ReadonlyArray<unknown>) => unknown;
}>;

export type HostileRun = Readonly<{
  helper: string;
  unit: string;
  style: 'string' | 'params';
  ms: number;
}>;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null;

const isCallable = (value: unknown): value is (...args: ReadonlyArray<unknown>) => unknown =>
  typeof value === 'function';

type FolderParams = Readonly<{ folder: string }>;

const sourceFilesOf = ({ folder }: FolderParams): ReadonlyArray<string> =>
  readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) {
      return SKIPPED_FOLDERS.includes(entry.name) ? [] : sourceFilesOf({ folder: path });
    }
    return /\.tsx?$/.test(entry.name) && !TEST_FILE.test(entry.name) ? [path] : [];
  });

type SourceParams = Readonly<{ source: string }>;

export const helperNamesIn = ({ source }: SourceParams): ReadonlyArray<string> =>
  Array.from(source.matchAll(EXPORTED_NAME), (match) => match[1] ?? '').filter((name) =>
    HELPER_KEYWORD.test(name),
  );

export const discoverHelperNames = (): ReadonlyArray<Readonly<{ file: string; name: string }>> =>
  sourceFilesOf({ folder: SRC_ROOT }).flatMap((path) =>
    helperNamesIn({ source: readFileSync(path, 'utf8') }).map((name) => ({
      file: relative(SRC_ROOT, path),
      name,
    })),
  );

export const loadHelpers = async (): Promise<ReadonlyArray<HostileHelper>> => {
  const found: HostileHelper[] = [];
  for (const { file, name } of discoverHelperNames()) {
    const loaded: unknown = await import(pathToFileURL(join(SRC_ROOT, file)).href);
    const fn = isRecord(loaded) ? loaded[name] : undefined;
    if (isCallable(fn)) {
      found.push({ name, file, fn });
    }
  }
  return found;
};

type InputParams = Readonly<{ input: string }>;

const paramsOf = ({ input }: InputParams): object =>
  new Proxy(
    {},
    {
      get: (_target, key) => (typeof key === 'string' ? input : undefined),
    },
  );

type RunParams = Readonly<{ run: () => unknown }>;

const swallow = async ({ run }: RunParams): Promise<void> => {
  try {
    await run();
  } catch {
    return;
  }
};

export const hostileInputsOf = (): ReadonlyArray<Readonly<{ unit: string; input: string }>> =>
  HOSTILE_UNITS.map((unit) => ({ unit, input: unit.repeat(HOSTILE_LENGTH) }));

type SweepParams = Readonly<{
  helper: Pick<HostileHelper, 'name' | 'fn'>;
  inputs?: ReadonlyArray<Readonly<{ unit: string; input: string }>>;
}>;

export const sweepHelper = async ({
  helper,
  inputs = hostileInputsOf(),
}: SweepParams): Promise<ReadonlyArray<HostileRun>> => {
  const runs: HostileRun[] = [];
  for (const { unit, input } of inputs) {
    const styles: ReadonlyArray<Readonly<{ style: HostileRun['style']; arg: unknown }>> = [
      { style: 'string', arg: input },
      { style: 'params', arg: paramsOf({ input }) },
    ];
    for (const { style, arg } of styles) {
      const started = performance.now();
      await swallow({ run: () => helper.fn(arg) });
      runs.push({ helper: helper.name, unit, style, ms: performance.now() - started });
    }
  }
  return runs;
};

type SlowParams = Readonly<{
  runs: ReadonlyArray<HostileRun>;
  budgetMs?: number;
}>;

export const slowRuns = ({
  runs,
  budgetMs = HOSTILE_BUDGET_MS,
}: SlowParams): ReadonlyArray<HostileRun> => runs.filter((run) => run.ms >= budgetMs);
