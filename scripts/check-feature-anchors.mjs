import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FEATURES_PATH = 'FEATURES.md';
const LINK_ANCHOR = /FEATURES\.md#([^)\s"'`]+)/g;
const SEE_HOW_ANCHOR = /<SeeHow\s+anchor="([^"]+)"/g;

export const slugOf = ({ heading }) =>
  heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '')
    .replace(/ /g, '-');

export const collectAnchors = ({ markdown }) => {
  const anchors = new Set();
  const counts = new Map();
  let isFenced = false;
  for (const line of markdown.split('\n')) {
    if (line.trimStart().startsWith('```')) {
      isFenced = !isFenced;
      continue;
    }
    const match = isFenced ? null : /^#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
    const explicit = isFenced ? null : /<a id="([^"]+)"><\/a>/g;
    if (explicit !== null) {
      for (const [, anchor] of line.matchAll(explicit)) {
        anchors.add(anchor);
      }
    }
    if (!match) {
      continue;
    }
    const slug = slugOf({ heading: match[1] });
    const seen = counts.get(slug) ?? 0;
    counts.set(slug, seen + 1);
    anchors.add(seen === 0 ? slug : `${slug}-${seen}`);
  }
  return anchors;
};

const listFiles = () =>
  execFileSync('git', ['ls-files', '*.md', 'website/src/*.tsx', 'website/src/**/*.tsx'], {
    cwd: ROOT_DIRECTORY,
  })
    .toString()
    .split('\n')
    .filter((path) => path !== '' && path !== 'CHANGELOG.md')
    .filter((path) => existsSync(resolve(ROOT_DIRECTORY, path)));

const collectMisses = ({ anchors }) =>
  listFiles().flatMap((path) => {
    const text = readFileSync(resolve(ROOT_DIRECTORY, path), 'utf8');
    const refs = [...text.matchAll(LINK_ANCHOR), ...text.matchAll(SEE_HOW_ANCHOR)].map(
      ([, anchor]) => anchor,
    );
    return refs.filter((anchor) => !anchors.has(anchor)).map((anchor) => `${path} #${anchor}`);
  });

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const anchors = collectAnchors({
    markdown: readFileSync(resolve(ROOT_DIRECTORY, FEATURES_PATH), 'utf8'),
  });
  const misses = collectMisses({ anchors });
  if (misses.length > 0) {
    console.error(`Links point to FEATURES.md anchors that do not exist:\n${misses.join('\n')}`);
    process.exitCode = 1;
  } else {
    console.log(`Feature anchors OK: ${anchors.size} headings`);
  }
}
