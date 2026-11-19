import { describe, expect, it } from 'vitest';
import { headerInstruction } from './headerInstruction';
import { GUIDE_HINTS } from './guideHints';
import { SHIP_HINTS } from './shipHints';

const fix = SHIP_HINTS.find((hint) => hint.id === 'fix-start');
const apply = SHIP_HINTS.find((hint) => hint.id === 'fix-apply');
const remove = SHIP_HINTS.at(-1);

if (fix === undefined || apply === undefined || remove === undefined) {
  throw new Error('missing ship fixtures');
}

describe('the header line', () => {
  it('says what to do now before the press', () => {
    expect(
      headerInstruction({
        held: undefined,
        acting: undefined,
        active: fix,
        last: remove,
        isRecovering: false,
      }),
    ).toBe(fix.instruction);
  });

  it('shows the progress line between the press and the result', () => {
    expect(
      headerInstruction({
        held: undefined,
        acting: fix,
        active: fix,
        last: remove,
        isRecovering: false,
      }),
    ).toBe(fix.progress);
  });

  it('keeps the instruction when the pressed step has no progress line', () => {
    expect(
      headerInstruction({
        held: undefined,
        acting: apply,
        active: apply,
        last: remove,
        isRecovering: false,
      }),
    ).toBe(apply.instruction);
  });

  it('shows the result of a finished step ahead of everything else', () => {
    expect(
      headerInstruction({
        held: fix,
        acting: fix,
        active: apply,
        last: remove,
        isRecovering: false,
      }),
    ).toBe(fix.result);
  });

  it('keeps the result of the last step on screen once the group is done', () => {
    expect(
      headerInstruction({
        held: remove,
        acting: undefined,
        active: undefined,
        last: remove,
        isRecovering: false,
      }),
    ).toBe(remove.result);
  });

  it('still names the last result after its hold ends, until the next group opens', () => {
    expect(
      headerInstruction({
        held: undefined,
        acting: undefined,
        active: undefined,
        last: remove,
        isRecovering: false,
      }),
    ).toBe(remove.result);
  });

  it('points back at the plan when its drawer was closed', () => {
    const comment = GUIDE_HINTS.find((hint) => hint.id === 'plan-comment');
    if (comment === undefined) {
      throw new Error('missing guide fixture');
    }
    expect(
      headerInstruction({
        held: undefined,
        acting: undefined,
        active: comment,
        last: GUIDE_HINTS.at(-1),
        isRecovering: true,
      }),
    ).toBe("Press the plan's title to open it again and go on.");
  });
});
