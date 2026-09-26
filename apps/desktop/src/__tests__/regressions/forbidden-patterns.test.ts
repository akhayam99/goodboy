import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..');
const BASELINE_PATH = join(__dirname, 'forbidden-patterns.baseline.json');
const IS_UPDATING = process.env.GOODBOY_UPDATE_BASELINE === '1';

const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set([
  'node_modules',
  'dist',
  'target',
  'gen',
  '__tests__',
  'testing',
]);

type SourceKind = 'ts' | 'rust' | 'config';

type SourceFile = {
  readonly path: string;
  readonly kind: SourceKind;
  readonly lines: ReadonlyArray<string>;
};

type Rule = {
  readonly id: string;
  readonly kinds: ReadonlyArray<SourceKind>;
  readonly count: (file: SourceFile) => number;
  readonly hint?: string;
};

type Counts = Readonly<Record<string, Readonly<Record<string, number>>>>;

type WalkParams = {
  readonly directory: string;
  readonly accept: (name: string) => boolean;
};

const walk = ({ directory, accept }: WalkParams): ReadonlyArray<string> => {
  if (!existsSync(directory)) {
    return [];
  }
  return readdirSync(directory).flatMap((entry) => {
    if (SKIPPED_DIRECTORIES.has(entry)) {
      return [];
    }
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) {
      return walk({ directory: full, accept });
    }
    return accept(entry) ? [full] : [];
  });
};

const isTsSource = (name: string): boolean =>
  (name.endsWith('.ts') || name.endsWith('.tsx')) &&
  !name.endsWith('.test.ts') &&
  !name.endsWith('.test.tsx') &&
  !name.endsWith('.d.ts');

const isConfig = (name: string): boolean =>
  name.endsWith('.yml') || name.endsWith('.yaml') || name.endsWith('.toml');

const packageSourceRoots = (): ReadonlyArray<string> =>
  readdirSync(join(REPO_ROOT, 'packages')).map((name) => join(REPO_ROOT, 'packages', name, 'src'));

type ReadParams = {
  readonly path: string;
  readonly kind: SourceKind;
};

const read = ({ path, kind }: ReadParams): SourceFile => ({
  path: relative(REPO_ROOT, path).split(sep).join('/'),
  kind,
  lines: readFileSync(path, 'utf8').split('\n'),
});

const collectSources = (): ReadonlyArray<SourceFile> => {
  const tsRoots = [join(REPO_ROOT, 'apps', 'desktop', 'src'), ...packageSourceRoots()];
  const ts = tsRoots.flatMap((directory) => walk({ directory, accept: isTsSource }));
  const rust = walk({
    directory: join(REPO_ROOT, 'apps', 'desktop', 'src-tauri', 'src'),
    accept: (name) => name.endsWith('.rs'),
  });
  const config = [
    ...readdirSync(REPO_ROOT)
      .filter(isConfig)
      .map((name) => join(REPO_ROOT, name)),
    ...walk({ directory: join(REPO_ROOT, '.github'), accept: isConfig }),
    ...readdirSync(join(REPO_ROOT, 'apps', 'desktop', 'src-tauri'))
      .filter(isConfig)
      .map((name) => join(REPO_ROOT, 'apps', 'desktop', 'src-tauri', name)),
  ].filter((path) => !path.endsWith('pnpm-lock.yaml'));
  return [
    ...ts.map((path) => read({ path, kind: 'ts' })),
    ...rust.map((path) => read({ path, kind: 'rust' })),
    ...config.map((path) => read({ path, kind: 'config' })),
  ];
};

const STRING_LITERAL = /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g;
const TOOLING_DIRECTIVE =
  /\/\/\s*@(?:vitest-environment|ts-expect-error|ts-ignore)|\/\/\/\s*<reference|\/\*\s*@vite-ignore\s*\*\//;

const EM_DASH = String.fromCharCode(0x2014);

const withoutStrings = (line: string): string => line.replace(STRING_LITERAL, '""');

type CountParams = {
  readonly file: SourceFile;
  readonly matches: (line: string) => boolean;
};

const countLines = ({ file, matches }: CountParams): number => file.lines.filter(matches).length;

const hasCodeComment = (line: string): boolean => {
  if (TOOLING_DIRECTIVE.test(line)) {
    return false;
  }
  const code = withoutStrings(line);
  return /(^|[^:])\/\/|\/\*/.test(code);
};

const RAW_TYPE_SIZE = /(?<![\w-])(?:[\w-]+:)*text-(?:3xs|2xs|xs|sm|base|lg|xl|[2-9]xl)(?![\w-])/;
const RAW_FONT_WEIGHT = /(?<![\w-])(?:[\w-]+:)*font-(?:medium|semibold)(?![\w-])/;
const RAW_LEADING = /(?<![\w-])(?:[\w-]+:)*leading-(?:\d|\[|[a-z])/;
const RAW_TRACKING = /(?<![\w-])(?:[\w-]+:)*tracking-(?:\[|[a-z])/;
const RAW_SCROLLER = /(?<![\w-])(?:[\w-]+:)*overflow-(?:x-|y-)?(?:auto|scroll)(?![\w-])/;
const TONE_BORDER_RAIL = /(?<![\w-])(?:[\w-]+:)*border-l-(?:2|4)(?![\w-])/;
const ROUNDED = /(?<![\w-])(?:[\w-]+:)*rounded(?:-|\b)/;
const SCROLL_OWNER = 'packages/ui/src/components/ScrollFade.tsx';

type ClassLineParams = {
  readonly file: SourceFile;
  readonly pattern: RegExp;
};

const countClassLines = ({ file, pattern }: ClassLineParams): number =>
  countLines({ file, matches: (line) => pattern.test(line) });

const TOP_LEVEL_COMPONENT =
  /^(?:export )?(?:const [A-Z][a-z][A-Za-z0-9]* = (?:memo\()?\(|function [A-Z])/;

const RULES: ReadonlyArray<Rule> = [
  {
    id: 'else-branch',
    kinds: ['ts'],
    count: (file) => countLines({ file, matches: (line) => /\}\s*else\b/.test(line) }),
  },
  {
    id: 'unbraced-if',
    kinds: ['ts'],
    count: (file) =>
      countLines({
        file,
        matches: (line) => /^\s*if \(.*\)\s*(?:return|continue|break|throw)\b/.test(line),
      }),
  },
  {
    id: 'extra-component-per-file',
    kinds: ['ts'],
    count: (file) =>
      file.path.endsWith('.tsx')
        ? Math.max(0, countLines({ file, matches: (line) => TOP_LEVEL_COMPONENT.test(line) }) - 1)
        : 0,
  },
  {
    id: 'function-component',
    kinds: ['ts'],
    count: (file) =>
      countLines({ file, matches: (line) => /^(?:export )?function [A-Z]/.test(line) }),
  },
  {
    id: 'comment',
    kinds: ['ts', 'rust'],
    count: (file) => countLines({ file, matches: hasCodeComment }),
  },
  {
    id: 'config-comment',
    kinds: ['config'],
    count: (file) => countLines({ file, matches: (line) => /^\s*#/.test(line) }),
  },
  {
    id: 'em-dash',
    kinds: ['ts', 'rust', 'config'],
    count: (file) => countLines({ file, matches: (line) => line.includes(EM_DASH) }),
  },
  {
    id: 'interface',
    kinds: ['ts'],
    count: (file) =>
      countLines({ file, matches: (line) => /^\s*(?:export )?interface \w/.test(line) }),
  },
  {
    id: 'export-function',
    kinds: ['ts'],
    count: (file) =>
      countLines({ file, matches: (line) => /^export (?:async )?function\b/.test(line) }),
  },
  {
    id: 'export-default',
    kinds: ['ts'],
    count: (file) => countLines({ file, matches: (line) => /^export default\b/.test(line) }),
  },
  {
    id: 'any',
    kinds: ['ts'],
    count: (file) =>
      countLines({
        file,
        matches: (line) => /(?::\s*any\b|\bas any\b|<any>)/.test(withoutStrings(line)),
      }),
  },
  {
    id: 'invoke-in-component-or-hook',
    kinds: ['ts'],
    count: (file) =>
      /\/(?:components|hooks)\/|\/use[A-Z][A-Za-z]*(?:\/|\.ts)/.test(file.path)
        ? countLines({
            file,
            matches: (line) =>
              /^import \{[^}]*\binvoke\b[^}]*\} from '@tauri-apps\/api\/core'/.test(line),
          })
        : 0,
  },
  {
    id: 'raw-type-size',
    kinds: ['ts'],
    count: (file) => countClassLines({ file, pattern: RAW_TYPE_SIZE }),
    hint: 'use a type role: text-row, not text-sm font-medium; text-label, not text-xs; text-secondary, not text-2xs; text-meta, not text-3xs',
  },
  {
    id: 'raw-font-weight',
    kinds: ['ts'],
    count: (file) => countClassLines({ file, pattern: RAW_FONT_WEIGHT }),
    hint: 'the weight comes with the role: text-row, text-heading, text-title, text-eyebrow',
  },
  {
    id: 'raw-leading',
    kinds: ['ts'],
    count: (file) => countClassLines({ file, pattern: RAW_LEADING }),
    hint: 'the line box comes with the role: text-prose, not text-sm leading-relaxed',
  },
  {
    id: 'raw-tracking',
    kinds: ['ts'],
    count: (file) => countClassLines({ file, pattern: RAW_TRACKING }),
    hint: 'tracking lives inside the roles: text-display, text-title, text-eyebrow',
  },
  {
    id: 'raw-scroller',
    kinds: ['ts'],
    count: (file) =>
      file.path === SCROLL_OWNER ? 0 : countClassLines({ file, pattern: RAW_SCROLLER }),
    hint: 'a region that scrolls is a ScrollFade',
  },
  {
    id: 'tone-border-rail',
    kinds: ['ts'],
    count: (file) =>
      countLines({
        file,
        matches: (line) => TONE_BORDER_RAIL.test(line) && ROUNDED.test(line),
      }),
    hint: 'a tone on a rounded box is a bar inside it, not a side border',
  },
];

const HINTS: Readonly<Record<string, string>> = Object.fromEntries(
  RULES.flatMap((rule) => (rule.hint === undefined ? [] : [[rule.id, rule.hint]])),
);

const measure = (): Counts => {
  const sources = collectSources();
  return Object.fromEntries(
    RULES.map((rule) => {
      const perFile = sources
        .filter((file) => rule.kinds.includes(file.kind))
        .map((file) => [file.path, rule.count(file)] as const)
        .filter(([, count]) => count > 0)
        .sort(([left], [right]) => left.localeCompare(right));
      return [rule.id, Object.fromEntries(perFile)];
    }),
  );
};

const isCounts = (value: unknown): value is Counts =>
  typeof value === 'object' &&
  value !== null &&
  Object.values(value).every(
    (files) =>
      typeof files === 'object' &&
      files !== null &&
      Object.values(files).every((count) => typeof count === 'number'),
  );

const readBaseline = (): Counts => {
  if (!existsSync(BASELINE_PATH)) {
    return {};
  }
  const parsed: unknown = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  return isCounts(parsed) ? parsed : {};
};

describe('forbidden code patterns only ever shrink', () => {
  const current = measure();

  it('finds sources in every scanned tree, never an empty sweep', () => {
    const scanned = collectSources();
    expect(scanned.some((file) => file.kind === 'ts')).toBe(true);
    expect(scanned.some((file) => file.kind === 'rust')).toBe(true);
    expect(scanned.some((file) => file.kind === 'config')).toBe(true);
  });

  it('adds no forbidden pattern to any file beyond its baseline', () => {
    if (IS_UPDATING) {
      writeFileSync(BASELINE_PATH, `${JSON.stringify(current, null, 2)}\n`);
      return;
    }
    const baseline = readBaseline();
    const grown = Object.entries(current).flatMap(([rule, files]) =>
      Object.entries(files).flatMap(([path, count]) => {
        const allowed = baseline[rule]?.[path] ?? 0;
        const hint = HINTS[rule] === undefined ? '' : `, ${HINTS[rule]}`;
        return count > allowed
          ? [`  - ${rule} ${path}: ${count} (baseline ${allowed})${hint}`]
          : [];
      }),
    );
    if (grown.length > 0) {
      throw new Error(
        `Forbidden patterns grew. AGENTS.md lists the rules; fix the new occurrences. A ` +
          `cleanup that lowers a count regenerates the baseline with ` +
          `GOODBOY_UPDATE_BASELINE=1.\n\n${grown.join('\n')}`,
      );
    }
    expect(grown).toEqual([]);
  });
});
