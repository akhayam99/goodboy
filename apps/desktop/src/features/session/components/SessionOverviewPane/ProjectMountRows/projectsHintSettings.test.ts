import { describe, expect, it } from 'vitest';
import {
  PROJECTS_HINT_DISMISSED_KEY,
  shouldDismissProjectsHint,
  shouldShowProjectsHint,
} from './projectsHintSettings';

describe('shouldShowProjectsHint', () => {
  it('stays hidden with no worktrees yet', () => {
    expect(shouldShowProjectsHint({ settings: {}, worktreeCount: 0 })).toBe(false);
  });

  it('shows once there is at least one worktree and the flag is unset', () => {
    expect(shouldShowProjectsHint({ settings: {}, worktreeCount: 1 })).toBe(true);
  });

  it('never shows again once dismissed', () => {
    expect(
      shouldShowProjectsHint({
        settings: { [PROJECTS_HINT_DISMISSED_KEY]: 'true' },
        worktreeCount: 1,
      }),
    ).toBe(false);
  });

  it('tolerates settings not being loaded yet', () => {
    expect(shouldShowProjectsHint({ settings: undefined, worktreeCount: 1 })).toBe(true);
  });
});

describe('shouldDismissProjectsHint', () => {
  it('does not dismiss with a single worktree', () => {
    expect(shouldDismissProjectsHint({ settings: {}, worktreeCount: 1 })).toBe(false);
  });

  it('dismisses once a second worktree exists', () => {
    expect(shouldDismissProjectsHint({ settings: {}, worktreeCount: 2 })).toBe(true);
  });

  it('never re-dismisses once the flag is already set', () => {
    expect(
      shouldDismissProjectsHint({
        settings: { [PROJECTS_HINT_DISMISSED_KEY]: 'true' },
        worktreeCount: 3,
      }),
    ).toBe(false);
  });
});
