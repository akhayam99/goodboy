// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { overviewLayoutEntries } from './overviewLayoutEntries';

describe('overviewLayoutEntries', () => {
  it('offers both commands, in both states', () => {
    const entries = overviewLayoutEntries({ switchTo: vi.fn(async () => true) });

    expect(entries.map((entry) => entry.label)).toEqual([
      'Use the new session overview',
      'Use the classic session overview',
    ]);
  });

  it('turns the new overview on without a toast', () => {
    const switchTo = vi.fn(async () => true);

    overviewLayoutEntries({ switchTo })[0]?.run();

    expect(switchTo).toHaveBeenCalledWith({ layout: 'new', hasUndo: false });
  });

  it('goes back to classic with the Undo toast', () => {
    const switchTo = vi.fn(async () => true);

    overviewLayoutEntries({ switchTo })[1]?.run();

    expect(switchTo).toHaveBeenCalledWith({ layout: 'classic', hasUndo: true });
  });
});
