import { describe, expect, it, vi } from 'vitest';
import type { Session, SessionId, WorkspaceId } from '@goodboy/types';
import { createUntitledSession } from './createUntitledSession';
import type { GetFn, SetFn } from './types';

const WS_ID = 'ws-1' as WorkspaceId;
const OTHER_WS_ID = 'ws-2' as WorkspaceId;

const sessionWith = (id: string, workspaceId: WorkspaceId, goal: string): Session =>
  ({ id: id as SessionId, workspaceId, goal }) as Session;

type Setup = {
  readonly sessions?: ReadonlyArray<Session>;
  readonly archived?: Readonly<Record<string, ReadonlyArray<Session>>>;
};

const setup = ({ sessions = [], archived = {} }: Setup = {}) => {
  const created = sessionWith('new-session', WS_ID, 'placeholder');
  const createSession = vi.fn(async ({ goal }: { goal: string }) => ({
    session: { ...created, goal },
    worktree: { worktreePath: '/tmp/x', branchName: '', slug: 'x', reused: false },
  }));
  const set = vi.fn();
  const get = () =>
    ({
      sessions,
      archivedSessions: archived,
      createSession,
    }) as unknown as ReturnType<GetFn>;
  const action = createUntitledSession(set as SetFn, get as GetFn);
  return { action, createSession, set };
};

describe('createUntitledSession', () => {
  it('creates instantly with the plain untitled title on an empty workspace', async () => {
    const { action, createSession } = setup();
    await action({ workspaceId: WS_ID });
    expect(createSession).toHaveBeenCalledWith({
      workspaceId: WS_ID,
      goal: 'Untitled session',
      omitGoalSlot: true,
    });
  });

  it('dedupes against active session titles in the same workspace', async () => {
    const { action, createSession } = setup({
      sessions: [sessionWith('s-1', WS_ID, 'Untitled session')],
    });
    await action({ workspaceId: WS_ID });
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({ goal: 'Untitled session 2' }),
    );
  });

  it('dedupes against archived sessions too', async () => {
    const { action, createSession } = setup({
      archived: { [WS_ID]: [sessionWith('s-9', WS_ID, 'Untitled session 3')] },
    });
    await action({ workspaceId: WS_ID });
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({ goal: 'Untitled session 4' }),
    );
  });

  it('scopes the dedupe to the target workspace', async () => {
    const { action, createSession } = setup({
      sessions: [sessionWith('s-1', OTHER_WS_ID, 'Untitled session')],
    });
    await action({ workspaceId: WS_ID });
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({ goal: 'Untitled session' }),
    );
  });

  it('flags the created session for title focus', async () => {
    const { action, set } = setup();
    const { session } = await action({ workspaceId: WS_ID });
    expect(set).toHaveBeenCalledWith({ pendingTitleFocusSessionId: session.id });
  });
});
