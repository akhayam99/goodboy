import { describe, expect, it } from 'vitest';
import { shellFoldsOf } from './shellFoldsOf';

describe('shellFoldsOf', () => {
  it('folds nothing with no pane open', () => {
    expect(shellFoldsOf({ paneSizing: null })).toEqual({ isRailNarrow: false });
  });

  it('folds nothing for a side tier pane', () => {
    expect(shellFoldsOf({ paneSizing: 'side' })).toEqual({ isRailNarrow: false });
  });

  it('folds the session rail to its icons for a reader tier pane, never the main sidebar', () => {
    expect(shellFoldsOf({ paneSizing: 'reader' })).toEqual({ isRailNarrow: true });
  });
});
