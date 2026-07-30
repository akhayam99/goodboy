import type { SessionId } from '@goodboy/types';
import { describe, expect, it } from 'vitest';
import { sessionWorktreePath } from './sessionWorktreePath';
import type { GetFn } from './types';

const SESSION_ID = 'session-1' as SessionId;

const getFn = (worktrees: Record<string, ReadonlyArray<string>>): GetFn =>
  (() => ({ sessionWorktrees: worktrees })) as unknown as GetFn;

describe('sessionWorktreePath', () => {
  it('returns the primary worktree of the session', () => {
    const get = getFn({ [SESSION_ID]: ['/tmp/wt', '/tmp/wt-secondary'] });

    expect(sessionWorktreePath({ get, sessionId: SESSION_ID })).toBe('/tmp/wt');
  });

  it('throws when the session has no worktree', () => {
    expect(() => sessionWorktreePath({ get: getFn({}), sessionId: SESSION_ID })).toThrow(
      'no worktree',
    );
    expect(() =>
      sessionWorktreePath({ get: getFn({ [SESSION_ID]: [''] }), sessionId: SESSION_ID }),
    ).toThrow('no worktree');
  });
});
