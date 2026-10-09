import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  appVersionOf,
  captionOf,
  readFigures,
  ROOT_DIRECTORY,
  VERSION_PATTERN,
} from './lib/figures.mjs';

const FIGURE_SRCSET = /(?:\/features\/|\/docs\/readme\/)([a-z0-9-]+)-dark\.webp$/;
const CAPTION_LINE = /^<sub>Screenshot from Goodboy [^<]*<\/sub>$/;

export const figureKeyOf = ({ srcset }) => {
  const name = FIGURE_SRCSET.exec(srcset)?.[1];
  if (name === undefined) {
    return null;
  }
  return srcset.includes('/docs/readme/') ? `readme/${name}` : `features/${name}`;
};

export const collectPictures = ({ markdown }) => {
  const lines = markdown.split('\n');
  const pictures = [];
  let open = null;
  lines.forEach((line, index) => {
    if (line.trim() === '<picture>') {
      open = { start: index, srcset: null };
      return;
    }
    if (open === null) {
      return;
    }
    const srcset = /<source\b[^>]*\bsrcset="([^"]+)"/.exec(line)?.[1];
    if (srcset !== undefined) {
      open.srcset = srcset;
    }
    if (line.trim() !== '</picture>') {
      return;
    }
    const next = lines.findIndex((candidate, at) => at > index && candidate.trim() !== '');
    pictures.push({
      start: open.start,
      end: index,
      key: open.srcset === null ? null : figureKeyOf({ srcset: open.srcset }),
      captionIndex: next === -1 ? null : next,
      caption: next === -1 ? null : lines[next].trim(),
    });
    open = null;
  });
  return pictures;
};

const compareVersions = ({ left, right }) => {
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] - rightParts[index];
    }
  }
  return 0;
};

export const findProblems = ({ documents, figures, repoVersion }) => {
  const problems = [];
  const referenced = new Set();
  for (const { path, markdown } of documents) {
    for (const picture of collectPictures({ markdown })) {
      const location = `${path}:${picture.end + 1}`;
      if (picture.key === null) {
        problems.push(`${location} picture has no goodboy-media or docs/readme dark source`);
        continue;
      }
      referenced.add(picture.key);
      const version = figures[picture.key]?.version;
      if (version === undefined || !VERSION_PATTERN.test(version)) {
        problems.push(`${location} ${picture.key} has no x.y.z version in docs/figures.json`);
        continue;
      }
      if (picture.caption !== captionOf({ version })) {
        problems.push(`${location} caption under ${picture.key} must be ${captionOf({ version })}`);
      }
    }
  }
  for (const [key, { version }] of Object.entries(figures)) {
    if (!referenced.has(key)) {
      problems.push(`docs/figures.json ${key} is not used by any picture`);
    }
    if (
      VERSION_PATTERN.test(version) &&
      compareVersions({ left: version, right: repoVersion }) > 0
    ) {
      problems.push(
        `docs/figures.json ${key} is ${version}, above the repo version ${repoVersion}`,
      );
    }
  }
  return problems;
};

export const writeCaptions = ({ markdown, figures }) => {
  const lines = markdown.split('\n');
  const pictures = collectPictures({ markdown });
  for (const picture of [...pictures].reverse()) {
    const version = picture.key === null ? undefined : figures[picture.key]?.version;
    if (version === undefined) {
      continue;
    }
    const caption = captionOf({ version });
    if (picture.caption !== null && CAPTION_LINE.test(picture.caption)) {
      lines[picture.captionIndex] = caption;
      continue;
    }
    lines.splice(picture.end + 1, 0, '', caption);
  }
  return lines.join('\n');
};

const documentPaths = () => [
  'README.md',
  'FEATURES.md',
  ...readdirSync(resolve(ROOT_DIRECTORY, 'docs/features'))
    .filter((name) => name.endsWith('.md'))
    .sort()
    .map((name) => `docs/features/${name}`),
];

const readDocuments = () =>
  documentPaths().map((path) => ({
    path,
    markdown: readFileSync(resolve(ROOT_DIRECTORY, path), 'utf8'),
  }));

const main = () => {
  const figures = readFigures();
  const documents = readDocuments();
  if (process.argv.includes('--write')) {
    for (const { path, markdown } of documents) {
      const next = writeCaptions({ markdown, figures });
      if (next !== markdown) {
        writeFileSync(resolve(ROOT_DIRECTORY, path), next);
        console.log(`captions written: ${path}`);
      }
    }
    return;
  }
  const problems = findProblems({
    documents,
    figures,
    repoVersion: appVersionOf(),
  });
  if (problems.length > 0) {
    console.error(`Figure captions are out of date:\n${problems.join('\n')}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Figure versions OK: ${Object.keys(figures).length} figures captioned`);
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
