// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { aSession, TEST_NOW } from '@goodboy/types/testing';
import { selectSessionById } from './selectSessionById';

const WS = 'workspace-harborline' as WorkspaceId;
const active = aSession({ id: 'session-ledger' as SessionId, workspaceId: WS });
const archived = aSession({
  id: 'session-notify' as SessionId,
  workspaceId: WS,
  archivedAt: TEST_NOW,
});
const state = { sessions: [active], archivedSessions: { [WS]: [archived] } };

describe('selectSessionById', () => {
  it('finds an active session', () => {
    expect(selectSessionById(state, active.id)).toBe(active);
  });

  it('falls back to the archived pool', () => {
    expect(selectSessionById(state, archived.id)).toBe(archived);
  });

  it('prefers the active row when both pools hold the id', () => {
    const shadow = { ...archived, id: active.id };

    expect(
      selectSessionById({ sessions: [active], archivedSessions: { [WS]: [shadow] } }, active.id),
    ).toBe(active);
  });

  it('returns null for a missing, empty or unknown id', () => {
    expect(selectSessionById(state, null)).toBeNull();
    expect(selectSessionById(state, '')).toBeNull();
    expect(selectSessionById(state, 'session-unknown')).toBeNull();
  });
});
