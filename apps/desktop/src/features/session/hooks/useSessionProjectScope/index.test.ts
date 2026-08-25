import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ProjectId, Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useSessionProjectScope } from './index';

const SESSION_ID = 'session-1' as SessionId;
const STORED = 'project-stored' as ProjectId;
const ON_ROW = 'project-row' as ProjectId;

const session = { id: SESSION_ID, activeProjectId: ON_ROW } as unknown as Session;

const seed = ({
  sessions,
  active,
}: {
  readonly sessions: ReadonlyArray<Session>;
  readonly active: Record<string, ProjectId>;
}) => {
  useAppStore.setState({ sessions, sessionActiveProject: active } as never);
};

describe('useSessionProjectScope', () => {
  it('prefers the project the store says is active', () => {
    seed({ sessions: [session], active: { [SESSION_ID]: STORED } });

    const { result } = renderHook(() => useSessionProjectScope({ sessionId: SESSION_ID }));

    expect(result.current).toBe(STORED);
  });

  it('falls back to the project on the session row', () => {
    seed({ sessions: [session], active: {} });

    const { result } = renderHook(() => useSessionProjectScope({ sessionId: SESSION_ID }));

    expect(result.current).toBe(ON_ROW);
  });

  it('has no scope for a session that touches no project', () => {
    seed({ sessions: [{ ...session, activeProjectId: undefined }], active: {} });

    const { result } = renderHook(() => useSessionProjectScope({ sessionId: SESSION_ID }));

    expect(result.current).toBeUndefined();
  });
});
