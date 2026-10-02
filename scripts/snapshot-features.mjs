import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FEATURES_PATH = resolve(ROOT_DIRECTORY, 'FEATURES.md');
const FEATURE_DOCS_DIRECTORY = resolve(ROOT_DIRECTORY, 'docs/features');
const CHANGELOG_PATH = resolve(ROOT_DIRECTORY, 'CHANGELOG.md');
const RELEASES_DIRECTORY = resolve(ROOT_DIRECTORY, 'website/src/data/releases');
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const IMAGE_PATTERN =
  /srcset="(?:\.\/docs\/readme|https:\/\/raw\.githubusercontent\.com\/akhayam99\/goodboy-media\/main\/features)\/([a-z0-9-]+)-dark\.webp"/;
const AREA_PATTERN = /<!-- gb area=([a-z-]+)/;
const TABLE_ROW_PATTERN = /^\|(.+)\|(.+)\|$/;
const TABLE_RULE_PATTERN = /^\|[\s|-]+\|$/;
const SUMMARY_HEADING_PATTERN = /^<summary><h2>(.+)<\/h2><\/summary>$/;

const slugify = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const plainText = (text) =>
  text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .trim();

const firstSentence = (text) => {
  const plain = plainText(text);
  const match = plain.match(/^(.+?[.?!])(?:\s|$)/);
  return match ? match[1] : plain;
};

const isProseLine = (line) => {
  const trimmed = line.trim();
  return trimmed.length > 0 && !/^(<|#|\||- )/.test(trimmed);
};

export const normalizeVersion = (input) => {
  const version = String(input ?? '').replace(/^v/, '');
  if (!VERSION_PATTERN.test(version)) {
    throw new Error(`"${input}" is not a version like 0.11.1`);
  }
  return version;
};

export const parseFeatures = ({ markdown }) => {
  const groups = [];
  let group = null;
  let feature = null;
  const lines = markdown.split('\n');
  for (const line of lines) {
    const summaryHeading = line.match(SUMMARY_HEADING_PATTERN);
    if (line.startsWith('## ') || summaryHeading) {
      const title = summaryHeading ? summaryHeading[1].trim() : line.slice(3).trim();
      group = { id: slugify(title), title, image: null, features: [] };
      groups.push(group);
      feature = null;
      continue;
    }
    if (!group) {
      continue;
    }
    if (line.startsWith('### ')) {
      const title = line.slice(4).trim();
      feature = { id: slugify(title), title, copy: '', image: null };
      group.features.push(feature);
      continue;
    }
    const image = line.match(IMAGE_PATTERN);
    if (image) {
      if (feature) {
        feature.image = image[1];
      } else {
        group.image = image[1];
      }
      continue;
    }
    const row = line.match(TABLE_ROW_PATTERN);
    if (row && !TABLE_RULE_PATTERN.test(line)) {
      const title = plainText(row[1]);
      const copy = plainText(row[2]);
      if (title === 'Feature') {
        continue;
      }
      group.features.push({ id: slugify(title), title, copy, image: null });
      feature = null;
      continue;
    }
    if (feature && !feature.copy && isProseLine(line)) {
      feature.copy = firstSentence(line);
    }
  }
  return groups.filter((entry) => entry.features.length > 0);
};

const sectionLines = ({ changelog, version }) => {
  const lines = changelog.split('\n');
  const start = lines.indexOf(`## Goodboy v${version}`);
  if (start === -1) {
    throw new Error(`CHANGELOG.md has no "## Goodboy v${version}" entry`);
  }
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith('## '));
  return end === -1 ? rest : rest.slice(0, end);
};

export const parseRelease = ({ changelog, version }) => {
  const lines = sectionLines({ changelog, version });
  const summaryLine = lines.find((line) => isProseLine(line));
  const items = [];
  let isInNew = false;
  let item = null;
  for (const line of lines) {
    if (line.startsWith('### ')) {
      isInNew = line.trim() === '### New';
      item = null;
      continue;
    }
    if (!isInNew) {
      continue;
    }
    if (line.startsWith('#### ')) {
      item = { title: plainText(line.slice(5)), area: null, copy: '' };
      items.push(item);
      continue;
    }
    const area = line.match(AREA_PATTERN);
    if (item && area && !item.area) {
      item.area = area[1];
      continue;
    }
    if (item && !item.copy && isProseLine(line)) {
      item.copy = firstSentence(line);
    }
  }
  return { summary: summaryLine ? plainText(summaryLine) : '', items };
};

export const buildSnapshot = ({ version, featuresMarkdown, changelog }) => {
  const release = parseRelease({ changelog, version });
  const newTitles = new Set(release.items.map((item) => item.title.toLowerCase()));
  const groups = parseFeatures({ markdown: featuresMarkdown }).map((group) => ({
    ...group,
    features: group.features.map((feature) => ({
      ...feature,
      isNew: newTitles.has(feature.title.toLowerCase()),
    })),
  }));
  return { version, summary: release.summary, new: release.items, groups };
};

export const aggregateFeatureDocs = () => {
  const index = readFileSync(FEATURES_PATH, 'utf8');
  const areas = [...index.matchAll(/^## (.+)\n[\s\S]*?\[All .*?\]\(docs\/features\/([a-z-]+)\.md\)$/gm)];
  const docs = areas.map(([, title, slug]) => ({
    title,
    body: readFileSync(resolve(FEATURE_DOCS_DIRECTORY, `${slug}.md`), 'utf8'),
  }));
  const foundRows = docs
    .flatMap(({ body }) => body.split('\n'))
    .filter((line) => /^\| (?:Written by Goodboy|Resolve again|Checks|Settings rail|Update pill) /.test(line));
  const groups = docs.map(({ title, body }) => {
    const guide = body
      .replace(/\n\n\*\*Also in this area\*\*[\s\S]*$/, '')
      .replace(/^# .+\n/, `## ${title}\n`)
      .trim();
    return guide;
  });
  const rowOrder = ['Written by Goodboy', 'Resolve again', 'Checks', 'Settings rail', 'Update pill'];
  const rows = rowOrder.map((title) => foundRows.find((line) => line.startsWith(`| ${title} `))).filter((line) => line !== undefined);
  return `${groups.join('\n\n')}\n\n## Also there\n\n| Feature | What it does for you |\n| ------- | -------------------- |\n${rows.join('\n')}\n`;
};

const main = () => {
  const version = normalizeVersion(process.argv[2]);
  const snapshot = buildSnapshot({
    version,
    featuresMarkdown: aggregateFeatureDocs(),
    changelog: readFileSync(CHANGELOG_PATH, 'utf8'),
  });
  mkdirSync(RELEASES_DIRECTORY, { recursive: true });
  const outputPath = resolve(RELEASES_DIRECTORY, `${version}.json`);
  writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  const featureCount = snapshot.groups.reduce((total, group) => total + group.features.length, 0);
  console.log(
    `snapshot ok: v${version}, ${snapshot.groups.length} groups, ${featureCount} features, ${snapshot.new.length} new`,
  );
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    main();
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exit(1);
  }
}
