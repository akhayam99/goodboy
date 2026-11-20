import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { baselineEntries } from './check-baselines.mjs';
import {
  baselineReadersOf,
  buildGraph,
  relatedSelection,
  selectionLines,
  testsReadingOf,
  testsSelection,
} from './ci-related-tests.mjs';

const WEBSITE_PATHS_READ_BY_TESTS = [
  'website/src/components/Logo.tsx',
  'website/src/pages/home/sections/Hero.tsx',
  'website/src/styles/base.css',
  'website/public/favicon.svg',
  'website/scripts/brand-assets/tileMetrics.mjs',
];

const DOC_PATHS_READ_BY_TESTS = [
  'docs/architecture.md',
  'docs/concepts.md',
  'docs/features',
  'docs/versioning.md',
];

const INERT_PATTERNS = [
  /^docs\/(?!changelog(?:\/|$))/,
  /^website\//,
  /^\.github\/[^/]+\.png$/,
  /^\.github\/pull_request_template\.md$/,
];

const RELATED_PATTERNS = [
  /^apps\/desktop\/src\/.+\.tsx?$/,
  /^packages\/[^/]+\/src\/.+\.tsx?$/,
  /^apps[/]desktop[/]src-tauri[/]/,
];

const SHARED_PATTERNS = [
  /^apps[/]desktop[/]src[/]__tests__[/]regressions[/]/,
  /^apps[/]desktop[/]src[/]test[/]/,
  /^packages[/][^/]+[/]src[/]test[/]/,
  /^apps\/desktop\/src\/store\/storyHarness\.ts$/,
];

const LINTED_SOURCE = /^(apps\/desktop\/src|packages\/[^/]+\/src|website\/src)\/.*\.tsx?$/;
const REGRESSION_BASELINE = /^apps\/desktop\/src\/__tests__\/regressions\/[^/]+\.baseline\.json$/;
const SUPPRESSIONS = /^eslint-suppressions(?:-strict)?\.json$/;
const DOC_PATH = /^docs\/|\.md$/;
const BASELINES_READ_BY_DOC_REFS = [
  'apps/desktop/src/__tests__/regressions/doc-budget.baseline.json',
];

export const MAX_RELATED_PATHS = 40;
export const DESKTOP_SHARDS = 6;

export const isInertPath = ({ path }) =>
  !WEBSITE_PATHS_READ_BY_TESTS.includes(path) &&
  !DOC_PATHS_READ_BY_TESTS.some((entry) => path === entry || path.startsWith(`${entry}/`)) &&
  INERT_PATTERNS.some((pattern) => pattern.test(path));

export const isRelatedPath = ({ path }) =>
  RELATED_PATTERNS.some((pattern) => pattern.test(path)) &&
  !SHARED_PATTERNS.some((pattern) => pattern.test(path));

export const shouldRunTests = ({ eventName, paths }) => {
  if (eventName !== 'pull_request') {
    return true;
  }
  if (paths === null || paths.length === 0) {
    return true;
  }
  return !paths.every((path) => isInertPath({ path }));
};

export const isNarrowChange = ({ eventName, paths }) => {
  if (eventName !== 'pull_request' || paths === null || paths.length === 0) {
    return false;
  }
  const live = paths.filter((path) => !isInertPath({ path }));
  return live.length <= MAX_RELATED_PATHS && live.every((path) => isRelatedPath({ path }));
};

export const testScopeOf = ({ eventName, paths }) => {
  if (!shouldRunTests({ eventName, paths })) {
    return 'none';
  }
  return isNarrowChange({ eventName, paths }) ? 'related' : 'full';
};

export const lintScopeOf = ({ eventName, paths }) => {
  if (eventName !== 'pull_request' || paths === null || paths.length === 0) {
    return 'all';
  }
  const live = paths.filter((path) => !isInertPath({ path }));
  if (live.length === 0) {
    return 'changed';
  }
  return isNarrowChange({ eventName, paths }) ? 'changed' : 'all';
};

const shardsOf = ({ count }) =>
  Array.from({ length: count }, (_, index) => `${index + 1}/${count}`);

export const testPlanOf = ({ scope, selection }) => {
  const full = {
    tests: true,
    scope: 'full',
    desktopShards: shardsOf({ count: DESKTOP_SHARDS }),
    zones: true,
    a11y: true,
  };
  if (scope === 'none') {
    return { ...full, tests: false, scope: 'none', zones: false, a11y: false };
  }
  if (scope === 'full' || selection === null) {
    return full;
  }
  if (selection.desktop.length * 2 > selection.desktopTotal) {
    return full;
  }
  const perShard = Math.ceil(selection.desktopTotal / (DESKTOP_SHARDS * 2));
  const count = Math.min(
    DESKTOP_SHARDS,
    Math.max(1, Math.ceil(selection.desktop.length / perShard)),
  );
  return {
    tests: true,
    scope: 'related',
    desktopShards: shardsOf({ count }),
    zones: selection.zones.length > 0,
    a11y: selection.isA11yReached,
  };
};

const countsOf = ({ path, text }) => {
  const counts = new Map();
  if (text === null) {
    return counts;
  }
  for (const entry of baselineEntries({ path, text })) {
    counts.set(entry.key, (counts.get(entry.key) ?? 0) + entry.count);
  }
  return counts;
};

export const isBaselineFalling = ({ path, baseText, headText }) => {
  const base = countsOf({ path, text: baseText });
  return [...countsOf({ path, text: headText })].every(
    ([key, count]) => count <= (base.get(key) ?? 0),
  );
};

const FULL_QUICK_PLAN = { scope: 'full', isDocRefsRun: false, lines: [] };

export const quickPlanOf = ({ paths, graphOf, isFallingOf }) => {
  const live = paths.filter((path) => !isInertPath({ path }) && !SUPPRESSIONS.test(path));
  if (live.length === 0) {
    return { scope: 'none', isDocRefsRun: false, lines: [] };
  }
  const baselines = live.filter((path) => REGRESSION_BASELINE.test(path));
  const docs = live.filter((path) => !REGRESSION_BASELINE.test(path) && DOC_PATH.test(path));
  const rest = live.filter((path) => !baselines.includes(path) && !docs.includes(path));
  if (baselines.some((path) => !isFallingOf({ path }))) {
    return FULL_QUICK_PLAN;
  }
  if (rest.length > 0 && testScopeOf({ eventName: 'pull_request', paths: rest }) === 'full') {
    return FULL_QUICK_PLAN;
  }
  const graph = graphOf();
  const readers = baselines.map((path) => ({ path, tests: baselineReadersOf({ graph, path }) }));
  if (
    readers.some(
      ({ path, tests }) => tests.length === 0 && !BASELINES_READ_BY_DOC_REFS.includes(path),
    )
  ) {
    return FULL_QUICK_PLAN;
  }
  const pinned = [
    ...readers.flatMap(({ tests }) => tests),
    ...docs.flatMap((path) => testsReadingOf({ graph, path })),
  ];
  const related =
    rest.length === 0
      ? []
      : selectionLines({ selection: relatedSelection({ graph, changed: rest }) });
  const lines = [
    ...related,
    ...selectionLines({ selection: testsSelection({ files: [...new Set(pinned)] }) }),
  ];
  return {
    scope: 'related',
    isDocRefsRun:
      docs.length > 0 || baselines.some((path) => BASELINES_READ_BY_DOC_REFS.includes(path)),
    lines: [...new Set(lines)],
  };
};

const gitShow = ({ ref, path }) => {
  try {
    return execFileSync('git', ['show', `${ref}:${path}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
};

const isFallingSince =
  ({ base }) =>
  ({ path }) => {
    try {
      return isBaselineFalling({
        path,
        baseText: gitShow({ ref: base, path }),
        headText: existsSync(path) ? readFileSync(path, 'utf8') : null,
      });
    } catch {
      return false;
    }
  };

export const readChangedPaths = () => {
  try {
    const output = execFileSync('git', ['diff', '--name-only', '--no-renames', 'HEAD^1', 'HEAD'], {
      encoding: 'utf8',
    });
    return output.split('\n').filter((line) => line.length > 0);
  } catch {
    return null;
  }
};

const livePaths = ({ paths }) => paths.filter((path) => !isInertPath({ path }));

const selectionFor = ({ scope, paths }) =>
  scope === 'related'
    ? relatedSelection({ graph: buildGraph(), changed: livePaths({ paths }) })
    : null;

const writeOutputs = ({ lines }) => {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    appendFileSync(outputFile, `${lines.join('\n')}\n`);
  }
};

const printList = ({ files }) => {
  process.stdout.write(files.join('\0'));
};

const runQuick = ({ base }) => {
  const paths = readFileSync(0, 'utf8')
    .split('\n')
    .filter((line) => line.length > 0);
  const plan = quickPlanOf({
    paths,
    graphOf: () => buildGraph({ isTypeOnlySkipped: true }),
    isFallingOf: isFallingSince({ base }),
  });
  const checks = plan.isDocRefsRun ? ['check doc-refs'] : [];
  process.stdout.write([`scope ${plan.scope}`, ...checks, ...plan.lines].join('\n'));
};

const runCli = () => {
  const quickAt = process.argv.indexOf('--quick');
  if (quickAt >= 0) {
    runQuick({ base: process.argv[quickAt + 1] ?? 'origin/main' });
    return;
  }
  const eventName = process.env.GITHUB_EVENT_NAME ?? '';
  const paths = eventName === 'pull_request' ? readChangedPaths() : [];
  const changed = paths === null ? 'unknown' : paths.length;
  if (process.argv.includes('--lint')) {
    const lint = lintScopeOf({ eventName, paths });
    const files =
      lint === 'all' ? [] : paths.filter((path) => LINTED_SOURCE.test(path) && existsSync(path));
    console.log(`event=${eventName} changed=${changed} lint=${lint} files=${files.length}`);
    writeOutputs({ lines: [`lint=${lint}`, 'files<<LINT_FILES_END', ...files, 'LINT_FILES_END'] });
    return;
  }
  const scope = testScopeOf({ eventName, paths });
  const listFlag = ['--desktop-tests', '--zone-tests'].find((flag) => process.argv.includes(flag));
  if (listFlag !== undefined) {
    if (scope !== 'related') {
      console.error(`ci-changes: ${listFlag} needs a related scope, this change is ${scope}`);
      process.exit(1);
    }
    const selection = selectionFor({ scope, paths });
    printList({ files: listFlag === '--desktop-tests' ? selection.desktop : selection.zones });
    return;
  }
  const selection = selectionFor({ scope, paths });
  const plan = testPlanOf({ scope, selection });
  const related =
    selection === null
      ? ''
      : ` desktop=${selection.desktop.length}/${selection.desktopTotal} zones=${selection.zones.length}`;
  console.log(
    `event=${eventName} changed=${changed} tests=${plan.tests} scope=${plan.scope} shards=${plan.desktopShards.length} a11y=${plan.a11y}${related}`,
  );
  writeOutputs({
    lines: [
      `tests=${plan.tests}`,
      `scope=${plan.scope}`,
      `desktop_shards=${JSON.stringify(plan.desktopShards)}`,
      `zones=${plan.zones}`,
      `a11y=${plan.a11y}`,
    ],
  });
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCli();
}
