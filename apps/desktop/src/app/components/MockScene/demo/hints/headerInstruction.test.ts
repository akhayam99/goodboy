import { describe, expect, it } from 'vitest';
import { DEMO_CHAPTERS } from '../demoChapters';
import { headerInstruction } from './headerInstruction';
import { REVIEW_HINTS } from './reviewHints';

const chapter = DEMO_CHAPTERS.find((entry) => entry.id === 'review');
const note = REVIEW_HINTS.find((hint) => hint.id === 'diff-note');
const handler = REVIEW_HINTS.find((hint) => hint.id === 'diff-file');

if (chapter === undefined || note === undefined || handler === undefined) {
  throw new Error('missing review fixtures');
}

describe('the header line', () => {
  it('says what to do now before the press', () => {
    expect(
      headerInstruction({
        chapter,
        held: undefined,
        acting: undefined,
        active: note,
        nextTitle: 'Get Goodboy',
      }),
    ).toBe(note.instruction);
  });

  it('shows the progress line between the press and the result', () => {
    expect(
      headerInstruction({
        chapter,
        held: undefined,
        acting: note,
        active: note,
        nextTitle: 'Get Goodboy',
      }),
    ).toBe('Write your note, then press Add note.');
  });

  it('keeps the instruction when the pressed step has no progress line', () => {
    expect(
      headerInstruction({
        chapter,
        held: undefined,
        acting: handler,
        active: handler,
        nextTitle: 'Get Goodboy',
      }),
    ).toBe(handler.instruction);
  });

  it('shows the result of a finished step ahead of everything else', () => {
    expect(
      headerInstruction({
        chapter,
        held: note,
        acting: note,
        active: handler,
        nextTitle: 'Get Goodboy',
      }),
    ).toBe(note.result);
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
