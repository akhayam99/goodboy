export const MAX_SENTENCE_WORDS = 30;
export const MAX_PARAGRAPH_WORDS = 120;
export const MAX_ALT_WORDS = 25;

export const RULE_FIXES = {
  'code-reference': 'move the identifier or path to the "Under the hood" section at the end',
  'long-sentence': `cut the sentence to ${MAX_SENTENCE_WORDS} words or fewer`,
  'long-paragraph': `cut the paragraph to ${MAX_PARAGRAPH_WORDS} words or fewer`,
  'long-alt': `cut the picture description to ${MAX_ALT_WORDS} words or fewer`,
  experimental: 'say what the feature does, not that it is experimental',
  windows: 'name no platform the app does not ship for',
  'retired-screen': 'name only a screen the app draws today, see shared/utils/names.ts',
  'path-form': 'write a settings path as Settings › App › Storage and a key as ⌘Z, never Cmd+Z',
};

export const RULE_IDS = Object.keys(RULE_FIXES);

const HOOD_HEADING = /^## Under the hood\s*$/;
const FENCE = /^\s*```/;
const LIST_ITEM = /^\s*(?:[-*]|\d+\.)\s+/;
const TABLE_SEPARATOR = /^\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const ANCHORED_PATH = /^(?:apps|packages|docs|website|scripts|packaging|\.github|src-tauri)[/]/;
const SOURCE_FOLDER = /^(?:features|store|shared|central)[/]/;
const SOURCE_FILE = /[A-Za-z0-9_-]+\.(?:tsx?|rs|mjs)\b/;
const CAMEL = /^[a-z]+[A-Z][A-Za-z0-9]*$/;
const PASCAL = /^[A-Z][a-z0-9]+[A-Z][A-Za-z0-9]*$/;
const SCREAMING = /^[A-Z][A-Z0-9]*_[A-Z0-9_]+$/;
const SNAKE = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/;
const DOTTED_ID = /^[a-z]+(?:\.[a-z]+)+$/;
const FILE_TAILS = new Set(['json', 'md', 'local', 'env', 'lock', 'yml', 'yaml', 'toml', 'txt']);
const EVENT_NAME = /\bgoodboy:[a-z-]+/;
const RETIRED_SCREENS = [
  /\bDeprecated\b/,
  /\bAuto agents\b/,
  /\bAgents entry\b/,
  /\bOrchestrated, Agents\b/,
  /\bActivity and Log tabs\b/,
  /\bunder \*\*Orchestrated\*\*/,
];
const PATH_FORMS = [
  /\bSettings > /,
  /\bSettings(?:\*\*)?, (?:\*\*)?[A-Z]/,
  /\bSettings under [A-Z]/,
  /\bCmd\+/,
];
const USER_FACING_NAMES = new Set(['node_modules', 'AppImage']);

const isIdentifierWord = ({ word }) =>
  !USER_FACING_NAMES.has(word) &&
  (CAMEL.test(word) || PASCAL.test(word) || SCREAMING.test(word) || SNAKE.test(word));

export const isCodeReference = ({ token }) => {
  if (ANCHORED_PATH.test(token) || SOURCE_FOLDER.test(token) || EVENT_NAME.test(token)) {
    return true;
  }
  if (!token.startsWith('src/') && SOURCE_FILE.test(token)) {
    return true;
  }
  if (DOTTED_ID.test(token) && !FILE_TAILS.has(token.split('.').at(-1))) {
    return true;
  }
  return (token.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []).some((word) => isIdentifierWord({ word }));
};

export const wordsOf = ({ text }) =>
  text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;

export const plainTextOf = ({ markdown }) =>
  markdown
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\*\*/g, '')
    .replace(/^>\s?/, '');

const SENTENCE_BREAK = /(?<=[.!?]["')\]]?)\s+(?=["'(*`\p{Lu}\p{N}⌘⌥⌃⇧])/u;

export const sentencesOf = ({ text }) =>
  text
    .split(SENTENCE_BREAK)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence !== '');

const cellsOf = ({ row }) =>
  row
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
    .filter((cell) => cell !== '');

export const paragraphsOf = ({ markdown }) => {
  const paragraphs = [];
  const alts = [];
  let current = null;
  let isFenced = false;
  let isHood = false;
  const flush = () => {
    if (current !== null) {
      paragraphs.push({ text: current, isHood });
    }
    current = null;
  };
  for (const line of markdown.split('\n')) {
    if (FENCE.test(line)) {
      flush();
      isFenced = !isFenced;
      continue;
    }
    if (isFenced) {
      continue;
    }
    if (HOOD_HEADING.test(line)) {
      flush();
      isHood = true;
      continue;
    }
    if (line.trim() === '' || /^#{1,6}\s/.test(line)) {
      flush();
      continue;
    }
    if (line.trimStart().startsWith('<')) {
      flush();
      const alt = /\balt="([^"]*)"/.exec(line)?.[1];
      if (alt !== undefined) {
        alts.push(alt);
      }
      continue;
    }
    if (line.trimStart().startsWith('|')) {
      flush();
      if (!TABLE_SEPARATOR.test(line.trim())) {
        cellsOf({ row: line }).forEach((cell) => paragraphs.push({ text: cell, isHood }));
      }
      continue;
    }
    if (LIST_ITEM.test(line)) {
      flush();
      current = line.replace(LIST_ITEM, '');
      continue;
    }
    current = current === null ? line.trim() : `${current} ${line.trim()}`;
  }
  flush();
  return { paragraphs, alts };
};

const tokensOf = ({ text }) => [...text.matchAll(/`([^`\n]+)`/g)].map((match) => match[1]);

export const measureMarkdown = ({ markdown }) => {
  const { paragraphs, alts } = paragraphsOf({ markdown });
  const counts = Object.fromEntries(RULE_IDS.map((id) => [id, 0]));
  for (const { text, isHood } of paragraphs) {
    if (!isHood) {
      counts['code-reference'] += tokensOf({ text }).filter((token) =>
        isCodeReference({ token }),
      ).length;
    }
    const plain = plainTextOf({ markdown: text });
    if (wordsOf({ text: plain }) > MAX_PARAGRAPH_WORDS) {
      counts['long-paragraph'] += 1;
    }
    counts['long-sentence'] += sentencesOf({ text: plain }).filter(
      (sentence) => wordsOf({ text: sentence }) > MAX_SENTENCE_WORDS,
    ).length;
  }
  counts['long-alt'] = alts.filter((alt) => wordsOf({ text: alt }) > MAX_ALT_WORDS).length;
  counts.experimental = (markdown.match(/\bExperimental\b/g) ?? []).length;
  counts.windows = (markdown.match(/\bWindows\b/g) ?? []).length;
  counts['retired-screen'] = RETIRED_SCREENS.reduce(
    (total, pattern) => total + (markdown.match(new RegExp(pattern, 'g')) ?? []).length,
    0,
  );
  counts['path-form'] = PATH_FORMS.reduce(
    (total, pattern) => total + (markdown.match(new RegExp(pattern, 'g')) ?? []).length,
    0,
  );
  return counts;
};

export const growthLines = ({ measured, baseline }) =>
  Object.entries(measured).flatMap(([file, counts]) =>
    RULE_IDS.flatMap((id) => {
      const allowed = baseline[id]?.[file] ?? 0;
      return counts[id] > allowed
        ? [`  - ${id} ${file}: ${counts[id]} (baseline ${allowed}), ${RULE_FIXES[id]}`]
        : [];
    }),
  );

export const baselineOf = ({ measured }) =>
  Object.fromEntries(
    RULE_IDS.map((id) => [
      id,
      Object.fromEntries(
        Object.entries(measured)
          .filter(([, counts]) => counts[id] > 0)
          .map(([file, counts]) => [file, counts[id]])
          .sort(([left], [right]) => left.localeCompare(right)),
      ),
    ]).filter(([, byFile]) => Object.keys(byFile).length > 0),
  );
