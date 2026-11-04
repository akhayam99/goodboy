// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { aView } from '../testing/autoViewFixtures';
import { mountedLineOf } from './mountedLineOf';
import { projectAskOf } from './projectAskOf';

const NOTE = {
  project: 'payments-api',
  branch: 'ak/feat-new-explore',
  reason: 'The user asked for a worktree.',
} as const;

describe('the project ask of a mount', () => {
  it('carries the project, the branch and the reason of a mount to confirm', () => {
    const ask = projectAskOf({
      view: aView({
        pendingRefusal: {
          action: 'mount',
          code: 'mount_missing',
          roles: [],
          mount: { ...NOTE, state: 'ask' },
        },
      }),
    });

    expect(ask?.mount).toEqual(NOTE);
  });

  it('keeps the plain folder list for a refused hand over that names no project', () => {
    const ask = projectAskOf({
      view: aView({
        pendingRefusal: { action: 'delegate', code: 'mount_missing', roles: ['implementer'] },
      }),
    });

    expect(ask).toMatchObject({ roleNoun: 'Implementer', mount: null });
  });

  it('shows no card for a mount that is done, only one line', () => {
    const view = aView({
      pendingRefusal: {
        action: 'mount',
        code: 'mounted',
        roles: [],
        mount: { ...NOTE, state: 'done' },
      },
    });

    expect(projectAskOf({ view })).toBeNull();
    expect(mountedLineOf({ view })).toBe('Mounted payments-api on ak/feat-new-explore');
  });
});
