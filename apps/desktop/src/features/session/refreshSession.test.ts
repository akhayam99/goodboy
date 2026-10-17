import { describe, expect, it, vi } from 'vitest';
import { aSession } from '@goodboy/types/testing';
import { refreshSession } from './refreshSession';

const SESSION_ID = aSession({ goal: 'Retry Harborline webhooks' }).id;

describe('refreshSession', () => {
  it('resyncs the session it names and reports nothing when that works', async () => {
    const resyncSession = vi.fn(async () => undefined);
    const reportError = vi.fn(async () => undefined);

    await refreshSession({ sessionId: SESSION_ID, resyncSession, reportError });

    expect(resyncSession).toHaveBeenCalledWith({ sessionId: SESSION_ID });
    expect(reportError).not.toHaveBeenCalled();
  });

  it('reports the failure against the same session, so the next refresh can retry', async () => {
    const failure = new Error('notify-relay unreachable');
    const resyncSession = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(undefined);
    const reportError = vi.fn(async () => undefined);

    await refreshSession({ sessionId: SESSION_ID, resyncSession, reportError });
    await refreshSession({ sessionId: SESSION_ID, resyncSession, reportError });

    expect(reportError).toHaveBeenCalledOnce();
    expect(reportError).toHaveBeenCalledWith({
      title: "Couldn't refresh this session",
      error: failure,
      sessionId: SESSION_ID,
    });
    expect(resyncSession).toHaveBeenCalledTimes(2);
  });
});
