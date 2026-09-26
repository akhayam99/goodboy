import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHANGELOG_PATH = resolve(ROOT_DIRECTORY, 'CHANGELOG.md');
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const RAW_CONTENT_ROOT = 'https://raw.githubusercontent.com/akhayam99/goodboy';
const ENTRY_TITLE_PATTERN = /^#### (.+)$/;
const IMAGE_TOKEN_PATTERN = /(?:^| )image=([a-z0-9]+(?:-[a-z0-9]+)*)(?= |$)/;
const NEXT_HEADING_PATTERN = /^#{3,4} /;

const parseVersion = ({ ref }) => {
  const withoutV = ref.startsWith('v') ? ref.slice(1) : ref;
  const rcIndex = withoutV.indexOf('-rc.');
  const version = rcIndex === -1 ? withoutV : withoutV.slice(0, rcIndex);
  if (!VERSION_PATTERN.test(version)) {
    throw new Error(`ref "${ref}" does not look like a release tag (vX.Y.Z or vX.Y.Z-rc.N)`);
  }
  return version;
};

const trimBlankEdges = ({ lines }) => {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start].trim().length === 0) {
    start += 1;
  }
  while (end > start && lines[end - 1].trim().length === 0) {
    end -= 1;
  }
  return lines.slice(start, end);
};

const extractSection = ({ changelog, heading }) => {
  const lines = changelog.split('\n');
  const startIndex = lines.findIndex((line) => line === heading);
  if (startIndex === -1) {
    return null;
  }
  const rest = lines.slice(startIndex + 1);
  const nextHeadingOffset = rest.findIndex((line) => line.startsWith('## '));
  const sectionLines = nextHeadingOffset === -1 ? rest : rest.slice(0, nextHeadingOffset);
  return trimBlankEdges({ lines: sectionLines }).join('\n');
};

const imageNameFromMeta = ({ metaLine }) => {
  const match = IMAGE_TOKEN_PATTERN.exec(metaLine);
  return match === null ? null : match[1];
};

const pictureBlockLines = ({ version, title, image }) => {
  const base = `${RAW_CONTENT_ROOT}/v${version}/docs/changelog/${version}/${image}-after`;
  const dark = `${base}-dark.webp`;
  const light = `${base}-light.webp`;
  return [
    '<picture>',
    `  <source media="(prefers-color-scheme: dark)" srcset="${dark}">`,
    `  <source media="(prefers-color-scheme: light)" srcset="${light}">`,
    `  <img alt="${title}" src="${light}">`,
    '</picture>',
  ];
};

const expandPictures = ({ notes, version }) => {
  const lines = notes.split('\n');
  const output = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    const titleMatch = ENTRY_TITLE_PATTERN.exec(line);
    const metaLine = titleMatch === null ? undefined : lines[index + 1];
    const image = metaLine === undefined ? null : imageNameFromMeta({ metaLine });
    if (titleMatch === null || image === null) {
      output.push(line);
      index += 1;
      continue;
    }
    const title = titleMatch[1];
    const body = [line, metaLine];
    index += 2;
    while (index < lines.length && !NEXT_HEADING_PATTERN.test(lines[index])) {
      body.push(lines[index]);
      index += 1;
    }
    while (body[body.length - 1] === '') {
      body.pop();
    }
    output.push(...body, '', ...pictureBlockLines({ version, title, image }), '');
  }
  return output.join('\n');
};

const main = () => {
  const ref = process.argv[2];
  if (ref === undefined) {
    console.error('::error::usage: release-notes.mjs <tag>');
    process.exitCode = 1;
    return;
  }
  const version = parseVersion({ ref });
  const heading = `## Goodboy v${version}`;
  const changelog = readFileSync(CHANGELOG_PATH, 'utf8');
  const notes = extractSection({ changelog, heading });
  if (notes === null || notes.length === 0) {
    console.error(
      `::error::No CHANGELOG.md entry found for '${heading}' (tag ${ref}). Add it before tagging.`,
    );
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`${expandPictures({ notes, version })}\n`);
};

main();
