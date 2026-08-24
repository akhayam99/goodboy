import { describe, expect, it } from 'vitest';
import type { SessionId } from '@goodboy/types';
import { resolveOpenDiffViewerEvent } from './openDiffViewerEvent';

const SESSION_ID = 'session-1' as SessionId;

describe('resolveOpenDiffViewerEvent', () => {
  it('resolves a cleared focus for a sessionId so the lens lands on the branch default', () => {
    const resolved = resolveOpenDiffViewerEvent({ detail: { sessionId: SESSION_ID } });
    expect(resolved).toEqual({ sessionId: SESSION_ID, focus: null });
  });

  it('returns null when the event carries no sessionId', () => {
    expect(resolveOpenDiffViewerEvent({ detail: undefined })).toBeNull();
    expect(resolveOpenDiffViewerEvent({ detail: {} })).toBeNull();
  });
});
