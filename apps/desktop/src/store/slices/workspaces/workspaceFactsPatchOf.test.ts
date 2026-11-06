import { describe, expect, it } from 'vitest';
import { brandId, type SessionId } from '@goodboy/types';
import { aDelegation, aView, FIXTURE_NOW } from '../../../features/auto/testing/autoViewFixtures';
import { workspaceFactsPatchOf } from './workspaceFactsPatchOf';

const SESSION = brandId<SessionId>({ value: 'session-harborline-1' });
const WAITING = aView({
  phase: 'waiting',
  delegations: [aDelegation({ key: 'fixer', role: 'implementer', state: 'accepted' })],
});

describe('workspaceFactsPatchOf', () => {
  it('starts the Auto clock from the views it installs, so a waiting child is old on first paint', () => {
    const patch = workspaceFactsPatchOf({
      state: {
        sessionOpenQuestions: {},
        sessionDismissedNextSteps: {},
        autoTreeViews: {},
        autoClockAt: 0,
      },
      facts: {
        sessionOpenQuestions: {},
        sessionDismissedNextSteps: {},
        autoTreeViews: { [SESSION]: [WAITING] },
        error: null,
      },
      now: FIXTURE_NOW + 61_000,
    });

    expect(patch.autoClockAt).toBe(FIXTURE_NOW + 60_000);
  });

  it('replaces a cached blocked view with the empty answer of a tree at rest', () => {
    const patch = workspaceFactsPatchOf({
      state: {
        sessionOpenQuestions: {},
        sessionDismissedNextSteps: {},
        autoTreeViews: { [SESSION]: [WAITING] },
        autoClockAt: 0,
      },
      facts: {
        sessionOpenQuestions: {},
        sessionDismissedNextSteps: {},
        autoTreeViews: { [SESSION]: [] },
        error: null,
      },
      now: FIXTURE_NOW,
    });

    expect(patch.autoTreeViews[SESSION]).toEqual([]);
    expect(patch.autoClockAt).toBe(0);
  });
});
