import { describe, expect, it } from 'vitest';
import type { MountId, SessionId } from '@goodboy/types';
import { selectSelectedMountId } from './selectedMountId';

const SESSION_ID = 'session-1' as SessionId;
const PERSISTED = 'mount-persisted' as MountId;
const EXPLICIT = 'mount-explicit' as MountId;

const session = { id: SESSION_ID, activeMountId: PERSISTED } as never;

describe('selectSelectedMountId', () => {
  it('consults the persisted value when the in-memory entry is absent', () => {
    expect(
      selectSelectedMountId({
        state: { sessions: [session], sessionActiveMount: {} },
        sessionId: SESSION_ID,
      }),
    ).toBe(PERSISTED);
  });

  it('uses an explicit in-memory id instead of the persisted value', () => {
    expect(
      selectSelectedMountId({
        state: { sessions: [session], sessionActiveMount: { [SESSION_ID]: EXPLICIT } },
        sessionId: SESSION_ID,
      }),
    ).toBe(EXPLICIT);
  });

  it('keeps an explicit null as a cleared selection', () => {
    expect(
      selectSelectedMountId({
        state: { sessions: [session], sessionActiveMount: { [SESSION_ID]: null } },
        sessionId: SESSION_ID,
      }),
    ).toBeNull();
  });
});
