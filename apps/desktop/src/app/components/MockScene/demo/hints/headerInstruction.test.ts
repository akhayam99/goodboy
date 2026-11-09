import { describe, expect, it } from 'vitest';
import { headerInstruction } from './headerInstruction';
import { SHIP_HINTS } from './shipHints';

const fix = SHIP_HINTS.find((hint) => hint.id === 'fix-start');
const apply = SHIP_HINTS.find((hint) => hint.id === 'fix-apply');

if (fix === undefined || apply === undefined) {
  throw new Error('missing ship fixtures');
}

describe('the header line', () => {
  it('says what to do now before the press', () => {
    expect(
      headerInstruction({
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
        held: fix,
        acting: fix,
        active: apply,
        nextTitle: 'Get Goodboy',
      }),
    ).toBe(fix.result);
  });

  it('says the group is done and names the next one once every step is done', () => {
    expect(
      headerInstruction({
        held: undefined,
        acting: undefined,
        active: undefined,
        nextTitle: 'Get Goodboy',
      }),
    ).toBe('Done. Next: Get Goodboy.');
  });

  it('keeps the last result on screen before it says the group is done', () => {
    expect(
      headerInstruction({
        held: fix,
        acting: undefined,
        active: undefined,
        nextTitle: 'Set the direction',
      }),
    ).toBe(fix.result);
  });
});
