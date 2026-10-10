import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const DEFAULT_BASE = 'origin/main';
const EXCEPTIONS_FILE = 'baseline-exceptions.json';
const SUPPRESSIONS_FILE = 'eslint-suppressions.json';
const ALLOWED_ROOT = 'apps/desktop/src/__tests__';
const SEPARATOR = ' > ';

const flatten = ({ value, trail }) => {
  if (typeof value === 'number') {
    return [{ trail, count: value }];
  }
  if (typeof value !== 'object' || value === null) {
    return [];
  }
  return Object.entries(value).flatMap(([key, child]) =>
    flatten({ value: child, trail: [...trail, key] }),
  );
};

export const baselineEntries = ({ path, text }) => {
  const rule = basename(path).replace(/(\.baseline)?\.json$/, '');
  return flatten({ value: JSON.parse(text), trail: [] }).map(({ trail, count }) => ({
    key: trail.join(SEPARATOR),
    rule,
    trail,
    count,
  }));
};

const skipString = ({ text, at }) => {
  const quote = text[at];
  let index = at + 1;
  while (index < text.length && text[index] !== quote) {
    index += text[index] === '\\' ? 2 : 1;
  }
  return index + 1;
};

const OPENERS = new Set(['{', '[', '(']);
const CLOSERS = new Set(['}', ']', ')']);

const closingIndex = ({ text, from }) => {
  let depth = 0;
  let index = from;
  while (index < text.length) {
    const char = text[index];
    if (char === "'" || char === '"' || char === '`') {
      index = skipString({ text, at: index });
      continue;
    }
    if (OPENERS.has(char)) {
      depth += 1;
    }
    if (CLOSERS.has(char)) {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
    index += 1;
  }
  return -1;
};

const afterBracket = ({ text, from }) => {
  const close = closingIndex({ text, from });
  return close < 0 ? text.length : close + 1;
};

const stringAt = ({ text, at }) => text.slice(at + 1, skipString({ text, at }) - 1);

const valueCount = ({ value }) => {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }
  const counted = /\bcount\s*:\s*(\d+)/.exec(trimmed);
  return trimmed.startsWith('{') && counted !== null ? Number(counted[1]) : 1;
};

const objectEntries = ({ body }) => {
  const entries = [];
  let index = 0;
  while (index < body.length) {
    const char = body[index];
    if (char !== "'" && char !== '"') {
      index = OPENERS.has(char) ? afterBracket({ text: body, from: index }) : index + 1;
      continue;
    }
    const key = stringAt({ text: body, at: index });
    const afterKey = skipString({ text: body, at: index });
    const colon = body.indexOf(':', afterKey);
    if (colon < 0 || body.slice(afterKey, colon).trim() !== '') {
      index = afterKey;
      continue;
    }
    let end = colon + 1;
    while (end < body.length && body[end] !== ',') {
      const next = body[end];
      if (next === "'" || next === '"' || next === '`') {
        end = skipString({ text: body, at: end });
        continue;
      }
      end = OPENERS.has(next) ? afterBracket({ text: body, from: end }) : end + 1;
    }
    entries.push({ key, count: valueCount({ value: body.slice(colon + 1, end) }) });
    index = end + 1;
  }
  return entries;
};

const setEntries = ({ body }) => {
  const keys = [];
  let index = 0;
  while (index < body.length) {
    const char = body[index];
    if (char === "'" || char === '"') {
      keys.push({ key: stringAt({ text: body, at: index }), count: 1 });
      index = skipString({ text: body, at: index });
      continue;
    }
    index += 1;
  }
  return keys;
};

const ALLOWED_DECLARATION = /\bconst ALLOWED\b[^=]*=\s*/g;

export const allowedEntries = ({ path, text }) => {
  const rule = basename(path).replace(/\.test\.tsx?$/, '');
  return [...text.matchAll(ALLOWED_DECLARATION)].flatMap((match) => {
    const start = match.index + match[0].length;
    const isSet = text.startsWith('new Set(', start);
    const open = isSet ? text.indexOf('[', start) : start;
    if (open < 0 || (!isSet && text[open] !== '{')) {
      return [];
    }
    const close = closingIndex({ text, from: open });
    if (close < 0) {
      return [];
    }
    const body = text.slice(open + 1, close);
    const entries = isSet ? setEntries({ body }) : objectEntries({ body });
    return entries.map(({ key, count }) => ({
      key: `ALLOWED${SEPARATOR}${key}`,
      rule,
      trail: [key],
      count,
    }));
  });
};

const entriesOf = ({ path, kind, text }) =>
  kind === 'json' ? baselineEntries({ path, text }) : allowedEntries({ path, text });

const isExcepted = ({ entry, exceptions }) =>
  exceptions.some(
    (exception) =>
      entry.trail.includes(exception.file) &&
      (exception.rule === entry.rule || entry.trail.includes(exception.rule)) &&
      entry.count <= exception.count,
  );

export const findGrowth = ({ files, readBase, readHead, exceptions }) =>
  files.flatMap(({ path, kind }) => {
    const headText = readHead({ path });
    const baseText = readBase({ path });
    if (headText === null || baseText === null) {
      return [];
    }
    const baseCounts = new Map(
      entriesOf({ path, kind, text: baseText }).map((entry) => [entry.key, entry.count]),
    );
    return entriesOf({ path, kind, text: headText }).flatMap((entry) => {
      const before = baseCounts.get(entry.key) ?? 0;
      if (entry.count <= before || isExcepted({ entry, exceptions })) {
        return [];
      }
      return [`  - ${path} ${entry.key}: ${entry.count} (base ${before})`];
    });
  });

export const parseExceptions = ({ text }) => {
  const parsed = JSON.parse(text);
  const isValid =
    Array.isArray(parsed) &&
    parsed.every(
      (entry) =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof entry.rule === 'string' &&
        typeof entry.file === 'string' &&
        typeof entry.count === 'number' &&
        typeof entry.reason === 'string' &&
        entry.reason !== '' &&
        typeof entry.release === 'string',
    );
  if (!isValid) {
    throw new Error(`${EXCEPTIONS_FILE} must be a list of { rule, file, count, reason, release }`);
  }
  return parsed;
};

const git = ({ args }) =>
  execFileSync('git', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  });

const readHead = ({ path }) => {
  const full = join(REPO_ROOT, path);
  return existsSync(full) ? readFileSync(full, 'utf8') : null;
};

const readBaseFrom =
  ({ base }) =>
  ({ path }) => {
    try {
      return git({ args: ['show', `${base}:${path}`] });
    } catch {
      return null;
    }
  };

const trackedFiles = ({ pathspec }) =>
  git({ args: ['ls-files', '-z', '--', pathspec] })
    .split('\0')
    .filter((path) => path !== '');

export const discoverFiles = () => {
  const baselines = [
    ...trackedFiles({ pathspec: '*.baseline.json' }),
    ...trackedFiles({ pathspec: SUPPRESSIONS_FILE }),
  ].map((path) => ({
    path,
    kind: 'json',
  }));
  const allowlists = trackedFiles({ pathspec: ALLOWED_ROOT })
    .filter((path) => /\.tsx?$/.test(path))
    .filter((path) => readHead({ path })?.includes('const ALLOWED') === true)
    .map((path) => ({ path, kind: 'allowed' }));
  return [...baselines, ...allowlists];
};

const baseFromArgs = ({ args }) => {
  const at = args.indexOf('--base');
  return at >= 0 && args[at + 1] !== undefined ? args[at + 1] : DEFAULT_BASE;
};

export const run = ({ args }) => {
  const base = baseFromArgs({ args });
  try {
    git({ args: ['rev-parse', '--verify', '--quiet', `${base}^{commit}`] });
  } catch {
    throw new Error(`base ref ${base} not found: run git fetch origin main`);
  }
  const exceptionsText = readHead({ path: EXCEPTIONS_FILE });
  return findGrowth({
    files: discoverFiles(),
    readBase: readBaseFrom({ base }),
    readHead,
    exceptions: exceptionsText === null ? [] : parseExceptions({ text: exceptionsText }),
  });
};

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    const lines = run({ args: process.argv.slice(2) });
    if (lines.length === 0) {
      console.log('baselines ok');
    } else {
      console.error(
        `baselines failed: ${lines.length} entr${lines.length === 1 ? 'y' : 'ies'} grew`,
      );
      console.error(lines.join('\n'));
      console.error(
        `\nA baseline only falls. Fix the code instead. Only the owner raises one, with an entry in ${EXCEPTIONS_FILE} (rule, file, count, reason, release). docs/ratchets.md explains.`,
      );
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(`baselines failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
