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
        isNextUpNext: true,
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
        isNextUpNext: true,
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
        isNextUpNext: true,
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
        isNextUpNext: true,
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
        isNextUpNext: true,
      }),
    ).toBe(`${chapter.title} is done. Go on with Get Goodboy, marked Up next.`);
  });

  it('names no Up next marker when the next group does not carry it', () => {
    expect(
      headerInstruction({
        chapter,
        held: undefined,
        acting: undefined,
        active: undefined,
        nextTitle: 'Set the direction',
        isNextUpNext: false,
      }),
    ).toBe(`${chapter.title} is done. Go on with Set the direction.`);
  });
});
