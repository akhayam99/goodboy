import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const BASELINE_FILES = {
  core: 'apps/desktop/src/__tests__/regressions/forbidden-patterns.baseline.json',
  guards: 'apps/desktop/src/__tests__/regressions/forbidden-patterns-guards.baseline.json',
};

const IGNORED_SEGMENTS = new Set(['node_modules', 'dist', 'target', 'gen']);
const TEST_SEGMENTS = new Set(['__tests__', 'testing']);
const TEST_NAME = /\.test\.(?:ts|tsx|mjs)$/;
const PACKAGE_SOURCE = /^packages[/]([^/]+)[/]src[/]/;
const CONFIG_EXTENSIONS = new Set(['.yml', '.yaml', '.toml']);

const extensionOf = ({ name }) => (name.includes('.') ? name.slice(name.lastIndexOf('.')) : '');

const areaOf = ({ path }) => {
  if (path.startsWith('apps/desktop/src-tauri/src/')) {
    return 'tauri';
  }
  if (path.startsWith('apps/desktop/src/')) {
    return 'desktop';
  }
  if (path.startsWith('website/src/')) {
    return 'website';
  }
  if (path.startsWith('scripts/')) {
    return 'scripts';
  }
  return PACKAGE_SOURCE.exec(path)?.[1] ?? null;
};

const isConfigPath = ({ path, name }) => {
  if (!CONFIG_EXTENSIONS.has(extensionOf({ name })) || name === 'pnpm-lock.yaml') {
    return false;
  }
  const depth = path.split('/').length;
  return (
    depth === 1 ||
    path.startsWith('.github/') ||
    (path.startsWith('apps/desktop/src-tauri/') && depth === 4)
  );
};

const kindOf = ({ path, name, area }) => {
  const extension = extensionOf({ name });
  if (area === 'scripts') {
    return extension === '.mjs' ? 'script' : null;
  }
  if (area !== null && (extension === '.ts' || extension === '.tsx') && area !== 'tauri') {
    return 'ts';
  }
  if (area !== null && extension === '.css') {
    return 'css';
  }
  if (area === 'tauri' && extension === '.rs') {
    return 'rust';
  }
  return isConfigPath({ path, name }) ? 'config' : null;
};

export const classifyPath = ({ path }) => {
  const segments = path.split('/');
  const name = segments[segments.length - 1] ?? '';
  if (segments.some((segment) => IGNORED_SEGMENTS.has(segment)) || name.endsWith('.d.ts')) {
    return null;
  }
  const area = areaOf({ path });
  const kind = kindOf({ path, name, area });
  if (kind === null) {
    return null;
  }
  const isTest =
    TEST_NAME.test(name) || segments.slice(0, -1).some((segment) => TEST_SEGMENTS.has(segment));
  const isCore =
    !isTest && (kind === 'rust' || kind === 'config' || (kind === 'ts' && area !== 'website'));
  return { path, kind, area, isTest, scope: isCore ? 'core' : 'extended' };
};

export const readSource = ({ path, text }) => {
  const classified = classifyPath({ path });
  return classified === null ? null : { ...classified, lines: text.split('\n') };
};

const walk = ({ directory }) => {
  if (!existsSync(directory)) {
    return [];
  }
  return readdirSync(directory).flatMap((entry) => {
    if (IGNORED_SEGMENTS.has(entry)) {
      return [];
    }
    const full = join(directory, entry);
    return statSync(full).isDirectory() ? walk({ directory: full }) : [full];
  });
};

const directChildren = ({ directory }) =>
  existsSync(directory) ? readdirSync(directory).map((entry) => join(directory, entry)) : [];

const toRepoPath = ({ full }) => relative(REPO_ROOT, full).split(sep).join('/');

export const collectSources = () => {
  const packageSources = readdirSync(join(REPO_ROOT, 'packages')).map((name) =>
    join(REPO_ROOT, 'packages', name, 'src'),
  );
  const directories = [
    join(REPO_ROOT, 'apps', 'desktop', 'src'),
    join(REPO_ROOT, 'apps', 'desktop', 'src-tauri', 'src'),
    join(REPO_ROOT, 'website', 'src'),
    join(REPO_ROOT, 'scripts'),
    join(REPO_ROOT, '.github'),
    ...packageSources,
  ];
  const fullPaths = [
    ...directChildren({ directory: REPO_ROOT }),
    ...directChildren({ directory: join(REPO_ROOT, 'apps', 'desktop', 'src-tauri') }),
    ...directories.flatMap((directory) => walk({ directory })),
  ].filter((full) => statSync(full).isFile());
  return fullPaths.flatMap((full) => {
    const path = toRepoPath({ full });
    return classifyPath({ path }) === null
      ? []
      : [readSource({ path, text: readFileSync(full, 'utf8') })];
  });
};

const STRING_LITERAL = /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g;
const TOOLING_DIRECTIVE =
  /[/][/]\s*@(?:vitest-environment|ts-expect-error|ts-ignore)|[/][/][/]\s*<reference|[/]\*\s*@vite-ignore\s*\*[/]/;

const EM_DASH = String.fromCharCode(0x2014);

export const withoutStrings = (line) => line.replace(STRING_LITERAL, '""');

const countLines = ({ file, matches }) => file.lines.filter(matches).length;

const hasCodeComment = (line) => {
  if (TOOLING_DIRECTIVE.test(line)) {
    return false;
  }
  const code = withoutStrings(line);
  return /(^|[^:])\/\/|\/\*/.test(code);
};

const hasCssComment = (line) => line.includes('/*');

const RAW_FONT_WEIGHT = /(?<![\w-])(?:[\w-]+:)*font-(?:medium|semibold)(?![\w-])/;
const RAW_LEADING = /(?<![\w-])(?:[\w-]+:)*leading-(?:\d|\[|[a-z])/;
const RAW_TRACKING = /(?<![\w-])(?:[\w-]+:)*tracking-(?:\[|[a-z])/;
const RAW_SCROLLER = /(?<![\w-])(?:[\w-]+:)*overflow-(?:x-|y-)?(?:auto|scroll)(?![\w-])/;
const TONE_BORDER_RAIL = /(?<![\w-])(?:[\w-]+:)*border-l-(?:2|4)(?![\w-])/;
const ROUNDED = /(?<![\w-])(?:[\w-]+:)*rounded(?:-|\b)/;
const HALF_STEP_SPACING =
  /(?<![\w-])(?:[\w-]+:)*-?(?:p|px|py|pt|pb|pl|pr|ps|pe|gap|gap-x|gap-y|m|mx|my|mt|mb|ml|mr|space-x|space-y)-[1-5]\.5(?![\w-])/;
const ROLE_CLASS = /(?<![\w-])(?:[\w-]+:)*text-(?:row|label|heading|title)(?![\w-])/;
const WEIGHT_CLASS = /(?<![\w-])(?:[\w-]+:)*font-(?:medium|semibold|bold)(?![\w-])/;
const FORMAT_ERROR_OWNER = 'packages/ui/src/formatError.ts';
const INVOKE_OWNER = 'apps/desktop/src/shared/lib/invokeCommand.ts';
const CAUGHT_SOURCE = /^(?:apps[/]desktop[/]src|packages[/]ui[/]src|packages[/]core[/]src)[/]/;
export const TAURI_CORE_IMPORT =
  /import\s+\{[^}]*\binvoke\b[^}]*\}\s*from\s*['"]@tauri-apps\/api\/core['"]|import\s+\*\s+as\s+\w+\s+from\s*['"]@tauri-apps\/api\/core['"]|import\(\s*['"]@tauri-apps\/api\/core['"]\s*\)|require\(\s*['"]@tauri-apps\/api\/core['"]\s*\)/g;
const CATCH_BINDING = /\bcatch\s*\(\s*(\w+)|\.catch\(\s*\(?\s*(\w+)/;
const CATCH_CONTINUATION_BINDING = /^\s*\(?\s*(\w+)\s*(?::[^)=]*)?\)?\s*=>/;

const braceDelta = (text) => {
  const code = withoutStrings(text);
  return code.split('{').length - code.split('}').length;
};

const stringifies = ({ line, name }) =>
  new RegExp(
    `\\bString\\(\\s*${name}\\s*\\)|\\$\\{\\s*${name}\\s*\\}|\\b${name}\\s*\\+\\s*(?:''|"")|(?:''|"")\\s*\\+\\s*${name}\\b|\\b${name}\\.toString\\(\\)|new Error\\(\\s*${name}\\s*\\)`,
  ).test(line);

export const countStringifiedCaughtErrors = (file) => {
  let depth = 0;
  let scopes = [];
  let previous = '';
  let count = 0;
  for (const line of file.lines) {
    const binding = CATCH_BINDING.exec(line);
    const continuation = /\.catch\(\s*$/.test(previous)
      ? CATCH_CONTINUATION_BINDING.exec(line)
      : null;
    const name = binding?.[1] ?? binding?.[2] ?? continuation?.[1];
    if (name !== undefined) {
      const at = binding?.index ?? 0;
      scopes = [...scopes, { name, depth: depth + braceDelta(line.slice(0, at)) }];
    }
    if (scopes.some((scope) => stringifies({ line, name: scope.name }))) {
      count += 1;
    }
    depth += braceDelta(line);
    scopes = scopes.filter((scope) => depth > scope.depth);
    previous = line;
  }
  return count;
};

const SCROLL_OWNER = 'packages/ui/src/components/ScrollFade/index.tsx';
export const FOOTER_CTA_BAR =
  /<footer\b|\bPopoverFooter\b|\bPANE_RHYTHM\.dock\b|\bdock=\{(?![^}]*\bcomposer\b)/;

const countClassLines = ({ file, pattern }) =>
  countLines({ file, matches: (line) => pattern.test(line) });

const TOP_LEVEL_COMPONENT =
  /^(?:export )?(?:const [A-Z][a-z][A-Za-z0-9]* = (?:memo\()?\(|function [A-Z])/;

export const INLINE_OBJECT_PARAM = /\(\s*(?:\{[^{}]*\}|\w+)\??\s*:\s*(?:Readonly<\s*)?\{[^{}]*\}/;
const POSITIONAL_DB_SAME_LINE =
  /^(?:export )?(?:const \w+ = (?:async )?|(?:async )?function \w+)\(\s*db\s*[:,)]/;
const POSITIONAL_DB_OPENER = /^(?:export )?(?:const \w+ = (?:async )?|(?:async )?function \w+)\($/;
const POSITIONAL_DB_NEXT = /^\s*db\s*[:,]/;
const USE_STATE_BOOLEAN =
  /\bconst \[\s*(\w+)\s*,[^\]]*\]\s*=\s*useState(?:<boolean>\(|\((?:true|false)\))/;
const BOOLEAN_MEMBER = /^\s*(?:readonly\s+)?(\w+)\??:\s*boolean\s*[;,]?\s*$/;
const BOOLEAN_NAME = /^(?:is|has|can|should|was|will)[A-Z0-9]/;
const RUST_ELSE = /\}\s*else\b/;
const SIBLING_MARGIN =
  /(?<![\w-])(?:[\w-]+:)*-?m(?:[trbl]|[xy](?!-auto\b))?-(?:\d|\[|px\b|auto\b|\()/;
const HOOK_FILE = /^(use[A-Z][A-Za-z0-9]*)\.tsx?$/;

const isPositionalDb = ({ lines, index }) => {
  const line = lines[index] ?? '';
  if (POSITIONAL_DB_SAME_LINE.test(line)) {
    return true;
  }
  return POSITIONAL_DB_OPENER.test(line) && POSITIONAL_DB_NEXT.test(lines[index + 1] ?? '');
};

const countPositionalDb = (file) =>
  file.lines.filter((_, index) => isPositionalDb({ lines: file.lines, index })).length;

const unprefixedBoolean = ({ line, isTsx }) => {
  const state = USE_STATE_BOOLEAN.exec(line);
  if (state !== null) {
    return !BOOLEAN_NAME.test(state[1] ?? '');
  }
  const member = isTsx ? BOOLEAN_MEMBER.exec(line) : null;
  return member !== null && !BOOLEAN_NAME.test(member[1] ?? '');
};

const countBooleanPrefix = (file) =>
  countLines({
    file,
    matches: (line) => unprefixedBoolean({ line, isTsx: file.path.endsWith('.tsx') }),
  });

export const componentNameOf = ({ path }) => {
  const segments = path.split('/');
  const name = segments[segments.length - 1] ?? '';
  if (!name.endsWith('.tsx') || name.endsWith('.test.tsx')) {
    return null;
  }
  const base = name === 'index.tsx' ? (segments[segments.length - 2] ?? '') : name.slice(0, -4);
  return /^[A-Z][A-Za-z0-9]*$/.test(base) ? base : null;
};

const countPropsNamedProps = (file) => {
  const component = componentNameOf({ path: file.path });
  if (component === null) {
    return 0;
  }
  const pattern = new RegExp(`^type ${component}Props\\b`);
  return countLines({ file, matches: (line) => pattern.test(line) });
};

export const isFlatHook = ({ path }) => {
  const segments = path.split('/');
  const name = segments[segments.length - 1] ?? '';
  const hook = HOOK_FILE.exec(name)?.[1];
  if (hook === undefined) {
    return false;
  }
  return segments[segments.length - 2] !== hook.slice(3);
};

const lineRule = ({ id, matches, hint, kinds = ['ts'], ...rest }) => ({
  id,
  kinds,
  matches,
  count: (file) => countLines({ file, matches }),
  hint,
  ...rest,
});

export const RULES = [
  lineRule({ id: 'else-branch', matches: (line) => /\}\s*else\b/.test(line) }),
  lineRule({
    id: 'unbraced-if',
    matches: (line) => /^\s*if \(.*\)\s*(?:return|continue|break|throw)\b/.test(line),
  }),
  {
    id: 'extra-component-per-file',
    kinds: ['ts'],
    count: (file) =>
      file.path.endsWith('.tsx')
        ? Math.max(0, countLines({ file, matches: (line) => TOP_LEVEL_COMPONENT.test(line) }) - 1)
        : 0,
  },
  lineRule({
    id: 'function-component',
    matches: (line) => /^(?:export )?function [A-Z]/.test(line),
  }),
  {
    id: 'comment',
    kinds: ['ts', 'rust', 'css', 'script'],
    includeTests: true,
    count: (file) =>
      countLines({ file, matches: file.kind === 'css' ? hasCssComment : hasCodeComment }),
  },
  lineRule({ id: 'config-comment', kinds: ['config'], matches: (line) => /^\s*#/.test(line) }),
  lineRule({
    id: 'em-dash',
    kinds: ['ts', 'rust', 'config', 'css', 'script'],
    includeTests: true,
    matches: (line) => line.includes(EM_DASH),
  }),
  lineRule({
    id: 'interface',
    matches: (line) => /^\s*(?:export )?interface \w/.test(line),
  }),
  lineRule({
    id: 'export-function',
    matches: (line) => /^export (?:async )?function\b/.test(line),
  }),
  lineRule({ id: 'export-default', matches: (line) => /^export default\b/.test(line) }),
  lineRule({
    id: 'any',
    matches: (line) => /(?::\s*any\b|\bas any\b|<any>)/.test(withoutStrings(line)),
  }),
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
    id: 'raw-tauri-invoke',
    kinds: ['ts'],
    count: (file) =>
      file.path === INVOKE_OWNER
        ? 0
        : (file.lines.join('\n').match(TAURI_CORE_IMPORT) ?? []).length,
    hint: 'call invokeCommand from shared/lib/invokeCommand.ts, never invoke: it gives every rejection a kind and a message',
  },
  {
    id: 'stringified-error',
    kinds: ['ts'],
    count: (file) =>
      CAUGHT_SOURCE.test(file.path) && file.path !== FORMAT_ERROR_OWNER
        ? countStringifiedCaughtErrors(file)
        : 0,
    hint: 'show a caught error with formatError from @goodboy/ui: String(error) prints [object Object] on a {kind, message} rejection',
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
  lineRule({
    id: 'tone-border-rail',
    matches: (line) => TONE_BORDER_RAIL.test(line) && ROUNDED.test(line),
    hint: 'a tone on a rounded box is a bar inside it, not a side border',
  }),
  lineRule({
    id: 'footer-cta-bar',
    matches: (line) => FOOTER_CTA_BAR.test(line),
    hint: 'a form or creation ends with FormActions inline after its content, never a footer bar with a divider (DESIGN-SYSTEM.md, Form actions)',
  }),
  {
    id: 'half-step-spacing',
    kinds: ['ts'],
    count: (file) => countClassLines({ file, pattern: HALF_STEP_SPACING }),
    hint: 'spacing sits on the 4px grid: use 1, 2 or 3 (4, 8, 12px), never 1.5, 2.5 or 3.5',
  },
  lineRule({
    id: 'role-weight-override',
    matches: (line) => ROLE_CLASS.test(line) && WEIGHT_CLASS.test(line),
    hint: 'a type role carries its own weight: drop font-medium, font-semibold or font-bold next to text-row, text-label, text-heading and text-title',
  }),
  lineRule({
    id: 'inline-object-param',
    ledger: 'guards',
    matches: (line) => INLINE_OBJECT_PARAM.test(withoutStrings(line)),
    hint: 'take one destructured object with a named Params or Props type, never an inline object type in the signature (AGENTS.md rule 1)',
  }),
  {
    id: 'positional-param',
    kinds: ['ts'],
    ledger: 'guards',
    roots: ['packages/db/src/queries/'],
    count: countPositionalDb,
    hint: 'a query takes one object ({ db, ...rest }: Params), never db as the first positional parameter (AGENTS.md rule 1)',
  },
  {
    id: 'boolean-prefix',
    kinds: ['ts'],
    ledger: 'guards',
    count: countBooleanPrefix,
    hint: 'name a boolean isX, hasX, canX or shouldX, for a prop and for useState (AGENTS.md rule 2)',
  },
  lineRule({
    id: 'rust-else',
    kinds: ['rust'],
    ledger: 'guards',
    matches: (line) => RUST_ELSE.test(withoutStrings(line)) && !/^\s*[/][/]/.test(line),
    hint: 'return early with a guard clause or let ... else; no } else chain (AGENTS.md rule 6)',
  }),
  lineRule({
    id: 'sibling-margin',
    kinds: ['ts', 'css'],
    ledger: 'guards',
    matches: (line) => SIBLING_MARGIN.test(line),
    hint: 'the parent gap spaces siblings: drop the margin and set gap on the parent (AGENTS.md rule 3)',
  }),
  {
    id: 'hook-folder',
    kinds: ['ts'],
    ledger: 'guards',
    count: (file) => (isFlatHook({ path: file.path }) ? 1 : 0),
    hint: 'a hook is a folder useFoo/index.ts, even alone; only Name/useName.ts beside its component may stay flat (docs/file-system.md, Hooks)',
  },
  {
    id: 'props-named-props',
    kinds: ['ts'],
    ledger: 'guards',
    count: countPropsNamedProps,
    hint: 'a component names its local props type Props, never after the component (docs/typescript/components.md)',
  },
];

export const applies = ({ rule, file }) => {
  if (!rule.kinds.includes(file.kind)) {
    return false;
  }
  if (file.isTest && rule.includeTests !== true) {
    return false;
  }
  return rule.roots === undefined || rule.roots.some((root) => file.path.startsWith(root));
};

export const ledgerOf = ({ rule, file }) =>
  rule.ledger === 'guards' || file.scope === 'extended' ? 'guards' : 'core';

export const countFor = ({ rule, file }) => (applies({ rule, file }) ? rule.count(file) : 0);

export const matchedLineNumbers = ({ rule, file }) =>
  rule.matches === undefined
    ? []
    : file.lines.flatMap((line, index) => (rule.matches(line) ? [index + 1] : []));

const sortedEntries = ({ entries }) => entries.sort(([left], [right]) => left.localeCompare(right));

export const measure = ({ sources }) => {
  const ledgers = { core: {}, guards: {} };
  for (const rule of RULES) {
    const perLedger = { core: [], guards: [] };
    for (const file of sources) {
      const count = countFor({ rule, file });
      if (count > 0) {
        perLedger[ledgerOf({ rule, file })].push([file.path, count]);
      }
    }
    for (const ledger of ['core', 'guards']) {
      if (ledger === 'guards' || rule.ledger !== 'guards') {
        ledgers[ledger][rule.id] = Object.fromEntries(
          sortedEntries({ entries: perLedger[ledger] }),
        );
      }
    }
  }
  return ledgers;
};

export const serializeLedger = ({ counts }) => `${JSON.stringify(counts, null, 2)}\n`;

const isCounts = (value) =>
  typeof value === 'object' &&
  value !== null &&
  Object.values(value).every(
    (files) =>
      typeof files === 'object' &&
      files !== null &&
      Object.values(files).every((count) => typeof count === 'number'),
  );

export const readBaselines = ({ root = REPO_ROOT } = {}) =>
  Object.fromEntries(
    Object.entries(BASELINE_FILES).map(([ledger, relativePath]) => {
      const full = join(root, relativePath);
      if (!existsSync(full)) {
        return [ledger, {}];
      }
      const parsed = JSON.parse(readFileSync(full, 'utf8'));
      return [ledger, isCounts(parsed) ? parsed : {}];
    }),
  );

export const hintOf = ({ ruleId }) => RULES.find((rule) => rule.id === ruleId)?.hint;

export const grownOffenses = ({ counts, baselines }) =>
  ['core', 'guards'].flatMap((ledger) =>
    Object.entries(counts[ledger] ?? {}).flatMap(([ruleId, files]) =>
      Object.entries(files).flatMap(([path, count]) => {
        const allowed = baselines[ledger]?.[ruleId]?.[path] ?? 0;
        return count > allowed ? [{ ruleId, path, count, allowed, hint: hintOf({ ruleId }) }] : [];
      }),
    ),
  );

export const offensesFor = ({ sources, baselines }) =>
  sources.flatMap((file) =>
    RULES.flatMap((rule) => {
      const count = countFor({ rule, file });
      if (count === 0) {
        return [];
      }
      const allowed = baselines[ledgerOf({ rule, file })]?.[rule.id]?.[file.path] ?? 0;
      return count > allowed
        ? [
            {
              ruleId: rule.id,
              path: file.path,
              count,
              allowed,
              hint: rule.hint,
              lines: matchedLineNumbers({ rule, file }),
            },
          ]
        : [];
    }),
  );

export const describeOffense = ({ offense }) => {
  const hint = offense.hint === undefined ? '' : `, ${offense.hint}`;
  const lines =
    offense.lines === undefined || offense.lines.length === 0
      ? ''
      : ` at line ${offense.lines.slice(0, 5).join(', ')}`;
  return `  - ${offense.ruleId} ${offense.path}: ${offense.count} (baseline ${offense.allowed})${lines}${hint}`;
};
