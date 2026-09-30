// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseSummaryDocument } from '@goodboy/core';
import { summaryDisplayBlocks } from './summaryDisplayBlocks';

const titlesOf = (text: string): ReadonlyArray<string> =>
  summaryDisplayBlocks({ document: parseSummaryDocument({ text }) }).map((block) => block.title);

describe('summaryDisplayBlocks', () => {
  it('shows State, Next and Learned in that order whatever order the document uses', () => {
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
    expect(titlesOf(scrambled)).toEqual(['State', 'Next', 'Learned']);
  });

  it('puts a preamble first and an unknown heading last', () => {
    const text = ['loose prose', '', '#### Risks', '- unknown', '', '#### Problem', 'known'].join(
      '\n',
    );
    expect(titlesOf(text)).toEqual(['Notes', 'State', 'Next', 'Learned', 'Risks']);
  });

  it('fills in a missing section as a placeholder once any section exists', () => {
    const blocks = summaryDisplayBlocks({
      document: parseSummaryDocument({ text: '#### State\nonly this' }),
    });
    expect(blocks.map((block) => block.title)).toEqual(['State', 'Next', 'Learned']);
    expect(blocks.map((block) => block.index)).toEqual([0, null, null]);
  });

  it('implies no structure over prose that carries none', () => {
    expect(titlesOf('**bold label:** legacy prose')).toEqual(['Notes']);
  });

  it('offers the three sections on a blank document, so nothing needs a placeholder', () => {
    const blocks = summaryDisplayBlocks({ document: parseSummaryDocument({ text: '' }) });

    expect(blocks.map((block) => block.title)).toEqual(['State', 'Next', 'Learned']);
    expect(blocks.map((block) => block.index)).toEqual([null, null, null]);
    expect(blocks.map((block) => block.body)).toEqual(['', '', '']);
  });

  it('hides a Problem section an older summary still carries', () => {
    const text = ['#### Problem', 'why', '', '#### State', '- now'].join('\n');
    expect(titlesOf(text)).toEqual(['State', 'Next', 'Learned']);
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
