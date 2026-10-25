import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { baselineOf, growthLines, measureMarkdown } from './lib/docBudget.mjs';

const ROOT_DIRECTORY =
  process.env.DOC_BUDGET_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FEATURES_DIRECTORY = 'docs/features';
const WALKTHROUGHS_DIRECTORY = 'docs/walkthroughs';
const FIRST_SESSION = 'docs/first-session.md';
const BASELINE_PATH = join(
  ROOT_DIRECTORY,
  'apps/desktop/src/__tests__/regressions/doc-budget.baseline.json',
);

const listMarkdown = ({ root, directory }) =>
  existsSync(join(root, directory))
    ? readdirSync(join(root, directory))
        .filter((name) => name.endsWith('.md'))
        .sort()
        .map((name) => `${directory}/${name}`)
    : [];

export const listDocs = ({ root }) => [
  'README.md',
  ...(existsSync(join(root, FIRST_SESSION)) ? [FIRST_SESSION] : []),
  ...listMarkdown({ root, directory: FEATURES_DIRECTORY }),
  ...listMarkdown({ root, directory: WALKTHROUGHS_DIRECTORY }),
];

export const measureDocs = ({ root }) =>
  Object.fromEntries(
    listDocs({ root }).map((path) => [
      path,
      measureMarkdown({ markdown: readFileSync(join(root, path), 'utf8') }),
    ]),
  );

export const run = ({ args, root, baselinePath }) => {
  const measured = measureDocs({ root });
  const isUpdating = args.includes('--update');
  const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, 'utf8')) : null;
  if (baseline === null && !isUpdating) {
    return {
      ok: false,
      lines: [
        '  - doc-budget.baseline.json is missing: restore it, or run with --update to start one',
      ],
    };
  }
  const grown = growthLines({ measured, baseline: baseline ?? {} });
  if (isUpdating && baseline !== null && grown.length > 0) {
    return { ok: false, lines: grown };
  }
  if (isUpdating) {
    writeFileSync(baselinePath, `${JSON.stringify(baselineOf({ measured }), null, 2)}\n`);
    return { ok: true, lines: ['doc budget baseline written'] };
  }
  return grown.length === 0 ? { ok: true, lines: ['doc budget ok'] } : { ok: false, lines: grown };
};

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  const result = run({
    args: process.argv.slice(2),
    root: ROOT_DIRECTORY,
    baselinePath: BASELINE_PATH,
  });
  if (result.ok) {
    console.log(result.lines.join('\n'));
  } else {
    console.error(
      `doc budget grew: docs/tone-of-voice.md and docs/recipes/feature-doc.md list the rules.\n${result.lines.join('\n')}\n\nA count only falls. Fix the page instead of the baseline.`,
    );
    process.exitCode = 1;
  }
}
