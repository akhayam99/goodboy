import { describe, expect, it } from 'vitest';
import { DEMO_CHAPTERS } from '../demoChapters';
import { headerInstruction } from './headerInstruction';
import { SHIP_HINTS } from './shipHints';

const chapter = DEMO_CHAPTERS.find((entry) => entry.id === 'ship');
const fix = SHIP_HINTS.find((hint) => hint.id === 'fix-start');
const apply = SHIP_HINTS.find((hint) => hint.id === 'fix-apply');

if (chapter === undefined || fix === undefined || apply === undefined) {
  throw new Error('missing ship fixtures');
}

describe('the header line', () => {
  it('says what to do now before the press', () => {
    expect(
      headerInstruction({
        chapter,
        held: undefined,
        acting: undefined,
        active: fix,
        nextTitle: 'Get Goodboy',
      }),
    ).toBe(fix.instruction);
  });

  it('shows the progress line between the press and the result', () => {
    expect(
      headerInstruction({
        chapter,
        held: undefined,
        acting: fix,
        active: fix,
        nextTitle: 'Get Goodboy',
      }),
    ).toBe(fix.progress);
  });

  it('keeps the instruction when the pressed step has no progress line', () => {
    expect(
      headerInstruction({
        chapter,
        held: undefined,
        acting: apply,
        active: apply,
        nextTitle: 'Get Goodboy',
      }),
    ).toBe(apply.instruction);
  });

  it('shows the result of a finished step ahead of everything else', () => {
    expect(
      headerInstruction({
        chapter,
        held: fix,
        acting: fix,
        active: apply,
        nextTitle: 'Get Goodboy',
      }),
    ).toBe(fix.result);
  });

  it('points at the next group once every step is done', () => {
    expect(
      headerInstruction({
        chapter,
        held: undefined,
        acting: undefined,
        active: undefined,
        nextTitle: 'Get Goodboy',
      }),
    ).toBe(`${chapter.title} is done. Go on with Get Goodboy, marked Up next.`);
  });
});
