import { describe, expect, it } from 'vitest';
import { parseSummaryDocument } from '@goodboy/core';
import { summaryDisplayBlocks } from './summaryDisplayBlocks';

const titlesOf = (text: string): ReadonlyArray<string> =>
  summaryDisplayBlocks({ document: parseSummaryDocument({ text }) }).map((block) => block.title);

describe('summaryDisplayBlocks', () => {
  it('shows the four sections in canonical order whatever order the document uses', () => {
    const scrambled = [
      '#### Next',
      '- later',
      '',
      '#### Problem',
      'now',
      '',
      '#### State',
      '- mid',
    ].join('\n');
    expect(titlesOf(scrambled)).toEqual(['Problem', 'Learned', 'State', 'Next']);
  });

  it('puts a preamble first and an unknown heading last', () => {
    const text = ['loose prose', '', '#### Risks', '- unknown', '', '#### Problem', 'known'].join(
      '\n',
    );
    expect(titlesOf(text)).toEqual(['Notes', 'Problem', 'Learned', 'State', 'Next', 'Risks']);
  });

  it('fills in a missing section as a placeholder once any section exists', () => {
    const blocks = summaryDisplayBlocks({
      document: parseSummaryDocument({ text: '#### Problem\nonly this' }),
    });
    expect(blocks.map((block) => block.title)).toEqual(['Problem', 'Learned', 'State', 'Next']);
    expect(blocks.map((block) => block.index)).toEqual([0, null, null, null]);
  });

  it('implies no structure for a document that carries none', () => {
    expect(titlesOf('**bold label:** legacy prose')).toEqual(['Notes']);
    expect(titlesOf('')).toEqual([]);
  });

  it('keeps the heading the document actually wrote as the block title', () => {
    const blocks = summaryDisplayBlocks({
      document: parseSummaryDocument({ text: '#### Next:\n- with a colon' }),
    });
    const next = blocks.find((block) => block.sectionKey === 'next');
    expect(next?.title).toBe('Next:');
    expect(next?.index).toBe(0);
  });
});
