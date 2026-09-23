import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EXCLUDED_DOCS = new Set(['CHANGELOG.md']);
const SOURCE_PATHSPEC = [':!*.md', ':!scripts/check-doc-refs.mjs'];
const PATH_ANCHOR = /^(apps|packages|docs|website|scripts|packaging|\.github)\//;
const PATH_PLACEHOLDER = /[*<>{}$]/;
const LINE_SUFFIX = /:\d+(-\d+)?$/;
const IDENTIFIER =
  /^([a-z]+[A-Z][A-Za-z0-9]*|[A-Z][a-z0-9]+[A-Z][A-Za-z0-9]*|[A-Z][A-Z0-9]*_[A-Z0-9_]+)$/;
const EXTERNAL_TARGET = /^[a-z][a-z0-9+.-]*:/;
const ALLOWLIST_REASON_BY_REF = new Map([
  ['PascalCase', { kind: 'vocabulary', reason: 'naming convention name' }],
  ['SCREAMING_SNAKE_CASE', { kind: 'vocabulary', reason: 'naming convention name' }],
  ['M3R9H4QX65', { kind: 'vocabulary', reason: 'apple signing team id' }],
  ['UpsertSessionParams', { kind: 'vocabulary', reason: 'illustrative params type' }],
  ['defaultProps', { kind: 'vocabulary', reason: 'react api named as forbidden' }],
  ['mNNNName', { kind: 'vocabulary', reason: 'migration name placeholder' }],
  ['mergedAt', { kind: 'vocabulary', reason: 'gh json field' }],
  ['MoreHorizontal', { kind: 'vocabulary', reason: 'retired lucide alias named on purpose' }],
  [
    'dangerousDisableAssetCspModification',
    { kind: 'vocabulary', reason: 'tauri config key named as forbidden' },
  ],
  ['docs/worktree-bridge.md', { kind: 'stale', reason: 'cluster 08 rewrites docs/event-bus.md' }],
]);

for (const [ref, entry] of ALLOWLIST_REASON_BY_REF) {
  if (ref.length === 0 || entry.reason.trim().length === 0) {
    throw new Error('Every allowlisted doc reference needs a name and reason');
  }
  if (entry.kind !== 'vocabulary' && entry.kind !== 'stale') {
    throw new Error(`Allowlisted doc reference ${ref} needs kind vocabulary or stale`);
  }
}

const git = ({ args }) =>
  execFileSync('git', args, { cwd: ROOT_DIRECTORY, maxBuffer: 1 << 28 }).toString();

const isGitIgnoredPath = ({ path }) => {
  try {
    execFileSync('git', ['check-ignore', '-q', '--no-index', path], { cwd: ROOT_DIRECTORY });
    return true;
  } catch {
    return false;
  }
};

const isKnownPath = ({ path }) =>
  existsSync(resolve(ROOT_DIRECTORY, path)) || isGitIgnoredPath({ path });

const listDocs = () =>
  git({ args: ['ls-files', '*.md'] })
    .split('\n')
    .filter((path) => path !== '' && !EXCLUDED_DOCS.has(path));

const collectKnownIdentifiers = () =>
  new Set(
    git({
      args: ['grep', '-I', '-h', '-o', '-E', '[A-Za-z_][A-Za-z0-9_]+', '--', ...SOURCE_PATHSPEC],
    }).split('\n'),
  );

const collectLineMisses = ({ doc, line, lineNumber, knownIdentifiers }) => {
  const misses = [];
  const location = `${doc}:${lineNumber}`;
  for (const [, target] of line.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
    if (EXTERNAL_TARGET.test(target)) {
      continue;
    }
    if (!existsSync(resolve(ROOT_DIRECTORY, dirname(doc), target))) {
      misses.push({ location, kind: 'link', ref: target });
    }
  }
  for (const [, raw] of line.matchAll(/`([^`\s]+)`/g)) {
    const token = raw.replace(/\(\)$/, '');
    const path = token.replace(LINE_SUFFIX, '');
    const isPath = PATH_ANCHOR.test(path) && !PATH_PLACEHOLDER.test(path);
    if (isPath && !isKnownPath({ path })) {
      misses.push({ location, kind: 'path', ref: path });
    }
    if (IDENTIFIER.test(token) && !knownIdentifiers.has(token)) {
      misses.push({ location, kind: 'symbol', ref: token });
    }
  }
  return misses;
};

const collectDocMisses = ({ doc, knownIdentifiers }) => {
  const misses = [];
  let isFenced = false;
  readFileSync(resolve(ROOT_DIRECTORY, doc), 'utf8')
    .split('\n')
    .forEach((line, index) => {
      if (line.trimStart().startsWith('```')) {
        isFenced = !isFenced;
        return;
      }
      if (isFenced) {
        return;
      }
      misses.push(...collectLineMisses({ doc, line, lineNumber: index + 1, knownIdentifiers }));
    });
  return misses;
};

const docs = listDocs();
const knownIdentifiers = collectKnownIdentifiers();
const allMisses = docs.flatMap((doc) => collectDocMisses({ doc, knownIdentifiers }));
const usedAllowlistRefs = new Set(
  allMisses.filter(({ ref }) => ALLOWLIST_REASON_BY_REF.has(ref)).map(({ ref }) => ref),
);
const misses = allMisses.filter(({ ref }) => !ALLOWLIST_REASON_BY_REF.has(ref));
const unusedAllowlistRefs = [...ALLOWLIST_REASON_BY_REF.keys()].filter(
  (ref) => !usedAllowlistRefs.has(ref),
);

if (misses.length > 0) {
  console.error(
    `Docs name what does not exist:\n${misses
      .map(({ location, kind, ref }) => `${location} ${kind} ${ref}`)
      .join('\n')}`,
  );
  process.exitCode = 1;
}
if (unusedAllowlistRefs.length > 0) {
  console.error(`Allowlisted but no longer referenced:\n${unusedAllowlistRefs.join('\n')}`);
  process.exitCode = 1;
}
if (misses.length === 0 && unusedAllowlistRefs.length === 0) {
  console.log(
    `Doc references OK: ${docs.length} docs, ${ALLOWLIST_REASON_BY_REF.size} allowlisted`,
  );
}
