// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { RESOLVE_GROUP_LABEL, RESOLVE_GROUP_OF_WORD, type ResolveWord } from './commentProjection';
import { isSettledWord } from './commentStates';

const CASES: ReadonlyArray<readonly [ResolveWord, string | null]> = [
  ['open', 'Needs you'],
  ['question', 'Needs you'],
  ['to_review', 'Needs you'],
  ['push_failed', 'Needs you'],
  ['couldnt_fix', 'Needs you'],
  ['working', 'Working'],
  ['ready', 'Done'],
  ['replied', 'Done'],
  ['done', 'Done'],
  ['left_open', null],
];

type WordParams = {
  readonly word: ResolveWord;
};

const groupLabelOf = ({ word }: WordParams): string | null => {
  const group = RESOLVE_GROUP_OF_WORD[word];
  return group === 'left_open' ? null : RESOLVE_GROUP_LABEL[group];
};

describe('the comment groups', () => {
  it.each(CASES)('puts %s under %s', (word, label) => {
    expect(groupLabelOf({ word })).toBe(label);
  });

  it('names exactly three groups', () => {
    const labels = new Set(CASES.map(([word]) => groupLabelOf({ word })));
    labels.delete(null);
    expect([...labels].sort()).toEqual(['Done', 'Needs you', 'Working']);
  });
});

describe('isSettledWord', () => {
  it('settles only what is resolved on the host', () => {
    expect(isSettledWord({ word: 'done' })).toBe(true);
    expect(isSettledWord({ word: 'replied' })).toBe(true);
    expect(isSettledWord({ word: 'ready' })).toBe(false);
  });
});
