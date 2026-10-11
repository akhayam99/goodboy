// @vitest-environment node
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { NAMES } from '../../../../shared/names';
import { GUIDE_CHAPTERS } from './guideChapters';

const CONCEPTS_DOC = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  '..',
  '..',
  'docs',
  'concepts.md',
);

const stem = (word: string): string => word.toLowerCase().replace(/s$/, '');

const nameValues = (): ReadonlyArray<string> => [
  ...Object.values(NAMES).flatMap((value) => (typeof value === 'string' ? [value] : [])),
  ...Object.values(NAMES.role),
];

const conceptList = (): ReadonlyArray<string> => {
  const glance =
    /## At a glance\n([\s\S]*?)\n## /.exec(readFileSync(CONCEPTS_DOC, 'utf8'))?.[1] ?? '';
  return Array.from(glance.matchAll(/^- \*\*([^*]+)\*\*/gm), (match) => match[1] ?? '');
};

const KNOWN = new Set([...nameValues(), ...Object.keys(CONCEPT_ICONS), ...conceptList()].map(stem));

const words = GUIDE_CHAPTERS.find((chapter) => chapter.id === 'words');

describe('the Words chapter', () => {
  it('sits second in Start here, after What is Goodboy', () => {
    const start = GUIDE_CHAPTERS.filter((chapter) => chapter.group === 'start');
    expect(start.map((chapter) => chapter.id)).toEqual(['overview', 'words']);
    expect(GUIDE_CHAPTERS[1]?.id).toBe('words');
  });

  it('defines the nine words, each in one sentence', () => {
    expect(words?.points.map((point) => point.term)).toEqual([
      'Workspace',
      'Project',
      'Session',
      'Agent',
      'Turn',
      'Run',
      'Worktree and branch',
      'Plan',
      'Budget',
    ]);
    const notOneSentence = (words?.points ?? []).filter(
      (point) => point.desc.split(/(?<=[.?!])\s+/).length > 2,
    );
    expect(notOneSentence.map((point) => point.term)).toEqual([]);
  });

  it('uses only terms that are a known name or a concept', () => {
    expect(KNOWN.size).toBeGreaterThan(20);
    const unknown = (words?.points ?? [])
      .flatMap((point) => point.term.split(' and '))
      .filter((term) => !KNOWN.has(stem(term)));
    expect(unknown).toEqual([]);
  });

  it('writes no dash and no first person', () => {
    const text = [words?.lead ?? '', ...(words?.points ?? []).map((point) => point.desc)].join(' ');
    const dashes = [8211, 8212].map((code) => String.fromCharCode(code));
    expect(dashes.filter((dash) => text.includes(dash))).toEqual([]);
    expect(text).not.toMatch(/\b(I|we|my|our)\b/i);
  });
});
