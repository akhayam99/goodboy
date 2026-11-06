// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseSummaryDocument } from '@goodboy/core/context';
import { summaryDisplayBlocks } from './summaryDisplayBlocks';

type Params = { readonly text: string };

const titlesOf = ({ text }: Params): ReadonlyArray<string> =>
  summaryDisplayBlocks({ document: parseSummaryDocument({ text }) }).map((block) => block.title);

describe('summaryDisplayBlocks', () => {
  it('shows Next and Learned in that order whatever order the document uses', () => {
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
    expect(titlesOf({ text: scrambled })).toEqual(['Next', 'Learned']);
  });

  it('puts a preamble first and an unknown heading last', () => {
    const text = ['loose prose', '', '#### Risks', '- unknown', '', '#### Problem', 'known'].join(
      '\n',
    );
    expect(titlesOf({ text: text })).toEqual(['Notes', 'Next', 'Learned', 'Risks']);
  });

  it('fills in a missing section as a placeholder once any section exists', () => {
    const blocks = summaryDisplayBlocks({
      document: parseSummaryDocument({ text: '#### State\nonly this' }),
    });
    expect(blocks.map((block) => block.title)).toEqual(['Next', 'Learned']);
    expect(blocks.map((block) => block.index)).toEqual([null, null]);
  });

  it('implies no structure over prose that carries none', () => {
    expect(titlesOf({ text: '**bold label:** legacy prose' })).toEqual(['Notes']);
  });

  it('offers the two sections on a blank document, so nothing needs a placeholder', () => {
    const blocks = summaryDisplayBlocks({ document: parseSummaryDocument({ text: '' }) });

    expect(blocks.map((block) => block.title)).toEqual(['Next', 'Learned']);
    expect(blocks.map((block) => block.index)).toEqual([null, null]);
    expect(blocks.map((block) => block.body)).toEqual(['', '']);
  });

  it('draws State only when it says more than the first sentence the glance line shows', () => {
    const short = ['#### State', '- one line only', '', '#### Next', '- later'].join('\n');
    expect(titlesOf({ text: short })).toEqual(['Next', 'Learned']);

    const long = ['#### State', '- one line', '- and another', '', '#### Next', '- later'].join(
      '\n',
    );
    expect(titlesOf({ text: long })).toEqual(['State', 'Next', 'Learned']);
  });

  it('hides a Problem section an older summary still carries', () => {
    const text = ['#### Problem', 'why', '', '#### State', '- now'].join('\n');
    expect(titlesOf({ text: text })).toEqual(['Next', 'Learned']);
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
