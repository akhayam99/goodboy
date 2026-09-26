import { describe, expect, it } from 'vitest';
import { CHANGELOG_SCREEN_VALUES } from './changelogScreens';
import { resolveChangelogScreenOverlay } from './resolveChangelogScreenOverlay';

describe('resolveChangelogScreenOverlay', () => {
  it('resolves every closed-list screen to an overlay without throwing', () => {
    CHANGELOG_SCREEN_VALUES.forEach((screen) => {
      expect(() => resolveChangelogScreenOverlay({ screen })).not.toThrow();
    });
  });

  it('opens settings on the workspace scope with the review-replies section', () => {
    expect(resolveChangelogScreenOverlay({ screen: 'settings/workspace/review-replies' })).toEqual({
      kind: 'settings',
      focus: { scope: 'workspace', section: 'review-replies' },
    });
  });

  it('opens the workflow overlay for both workflow screens', () => {
    expect(resolveChangelogScreenOverlay({ screen: 'workflows' })).toEqual({ kind: 'workflow' });
    expect(resolveChangelogScreenOverlay({ screen: 'workflows/steps' })).toEqual({
      kind: 'workflow',
    });
  });
});
