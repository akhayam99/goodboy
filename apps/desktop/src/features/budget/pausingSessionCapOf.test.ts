// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type SessionId } from '@goodboy/types';
import { pausingSessionCapOf } from './pausingSessionCapOf';

const SESSION = brandId<SessionId>({ value: 'session-harborline' });

describe('pausingSessionCapOf', () => {
  it('caps Auto at a session budget that pauses', () => {
    expect(
      pausingSessionCapOf({ budget: { sessionId: SESSION, softCapUsd: 3, onExceed: 'pause' } }),
    ).toBe(3);
  });

  it('caps nothing for a session budget that only warns', () => {
    expect(
      pausingSessionCapOf({ budget: { sessionId: SESSION, softCapUsd: 3, onExceed: 'warn' } }),
    ).toBeNull();
  });

  it('caps nothing without a session budget', () => {
    expect(pausingSessionCapOf({ budget: undefined })).toBeNull();
  });
});
