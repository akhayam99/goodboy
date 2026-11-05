import { FEATURE_DOCS_DIRECTORY } from '../constants.mjs';
import { readDoc } from '../readers/readDoc.mjs';

const guideEntries = ({ area }) => {
  const source = readDoc({ file: `${FEATURE_DOCS_DIRECTORY}/${area}.md` });
  if (source === null) {
    return null;
  }
  const lines = source.split('\n');
  const headings = lines
    .filter((line) => line.startsWith('### '))
    .map((line) => line.slice(4).trim());
  const rows = lines
    .filter((line) => /^\| /.test(line) && !/^\| (-|Feature)/.test(line))
    .map((line) => line.split('|')[1].trim());
  return {
    h1: (lines.find((line) => line.startsWith('# ')) ?? '').slice(2).trim(),
    headings,
    rows,
  };
};

const indexMainItems = () => {
  const index = new Map();
  let current = null;
  (readDoc({ file: 'FEATURES.md' }) ?? '').split('\n').forEach((line) => {
    if (line.startsWith('## ')) {
      current = line.slice(3).trim();
      index.set(current, []);
    } else if (current !== null && line.startsWith('- ')) {
      index.get(current).push(
        line
          .slice(2)
          .trim()
          .replace(/^\*\*(.+?)\*\*: .*$/, '$1'),
      );
    }
  });
  return index;
};

export const checkClusters = ({ clusters }) => {
  const failures = [];
  const index = indexMainItems();
  clusters.forEach((cluster) => {
    const fail = (message) => failures.push(`cluster ${cluster.id}: ${message}`);
    const mains = cluster.items.filter((item) => item.main === true);
    if (mains.length < 3 || mains.length > 5) {
      fail(`${mains.length} main items, 3 to 5 are needed`);
    }
    cluster.items
      .filter((item) => item.main !== true && (item.also ?? '').trim() === '')
      .forEach((item) => fail(`"${item.title}" is neither a main item nor has an also noun`));
    if (cluster.guides.length === 0) {
      fail('no guide link');
    }
    const known = new Set();
    const indexed = new Set();
    cluster.guides.forEach((guide) => {
      const entries = guideEntries({ area: guide.area });
      if (entries === null) {
        fail(`guide area ${guide.area} has no docs/features/${guide.area}.md`);
        return;
      }
      if (entries.h1 !== guide.label) {
        fail(`guide label "${guide.label}" is not the title "${entries.h1}" of ${guide.area}.md`);
      }
      if (!cluster.groups.includes(guide.label)) {
        fail(`guide "${guide.label}" is not one of the cluster groups`);
      }
      [...entries.headings, ...entries.rows].forEach((title) => known.add(title));
      (index.get(guide.label) ?? []).forEach((title) => indexed.add(title));
      entries.headings
        .filter((title) => !cluster.items.some((item) => item.title === title))
        .forEach((title) => fail(`guide entry "${title}" of ${guide.area}.md is not an item`));
    });
    cluster.items
      .filter((item) => !known.has(item.title))
      .forEach((item) => fail(`item "${item.title}" is in none of the guide files`));
    mains
      .filter((item) => !indexed.has(item.title))
      .forEach((item) =>
        fail(`main item "${item.title}" is not a main item of the FEATURES.md index`),
      );
    cluster.items
      .filter((item) => !cluster.groups.includes(item.group))
      .forEach((item) => fail(`item "${item.title}" has the unknown group "${item.group}"`));
  });
  return failures;
};
