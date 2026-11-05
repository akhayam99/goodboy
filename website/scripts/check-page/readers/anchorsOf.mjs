import { readDoc } from './readDoc.mjs';

const githubSlug = (text) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^\w\- ]+/g, '')
    .replace(/\s+/g, '-');

const docHeadings = ({ file }) => {
  const source = readDoc({ file });
  if (source === null) {
    return null;
  }
  return source.split('\n').flatMap((line) => {
    const summary = line.match(/^<summary><h2>(.*)<\/h2><\/summary>/);
    if (summary !== null) {
      return [summary[1]];
    }
    return /^#{1,3} /.test(line) ? [line.replace(/^#{1,3} /, '').trim()] : [];
  });
};

const docAnchors = ({ file }) => {
  const seen = new Map();
  return (docHeadings({ file }) ?? [])
    .map((heading) => githubSlug(heading))
    .map((slug) => {
      const count = seen.get(slug) ?? 0;
      seen.set(slug, count + 1);
      return count === 0 ? slug : `${slug}-${count}`;
    });
};

const anchorCache = new Map();

export const anchorsOf = ({ file }) => {
  if (!anchorCache.has(file)) {
    anchorCache.set(file, readDoc({ file }) === null ? null : docAnchors({ file }));
  }
  return anchorCache.get(file);
};
