import { describe, expect, it } from 'vitest';
import { WORK_ROW } from './workMetaSpec';

const tokensOf = ({ classes }: { readonly classes: string }): ReadonlyArray<string> =>
  classes.split(' ');

describe('WORK_ROW.stateSlot', () => {
  const tokens = tokensOf({ classes: WORK_ROW.stateSlot });

  it('grows with its words between 112px and 256px', () => {
    expect(tokens).toContain('min-w-28');
    expect(tokens).toContain('max-w-64');
  });

  it('is not a fixed width any more, so a long state shows when the row has room', () => {
    expect(tokens).not.toContain('w-28');
    expect(tokens).not.toContain('@max-[790px]:w-24');
  });

  it('keeps its place at the right end of the row and leaves a narrow row to the title', () => {
    expect(tokens).toContain('shrink-0');
    expect(tokens).toContain('justify-end');
    expect(tokens).toContain('@max-[790px]:min-w-24');
    expect(tokens).toContain('@max-[320px]:hidden');
  });
});
