import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHANGELOG_PATH = resolve(ROOT_DIRECTORY, 'CHANGELOG.md');
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

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
  process.stdout.write(`${notes}\n`);
};

main();
