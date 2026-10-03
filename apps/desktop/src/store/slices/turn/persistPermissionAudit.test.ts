vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, ProviderRunId, SessionId } from '@goodboy/types';
import { resetStorySpies, stubStoryInvoke } from '../../storyHarness';
import { persistPermissionAudit } from './persistPermissionAudit';

type AuditInput = {
  readonly id: string | null;
  readonly toolName: string;
  readonly decidedBy: string;
};
type RetryInput = { readonly id: string; readonly payloadJson: string };

const makePayload = (decidedBy: 'default' | 'rule' | 'user') => ({
  id: 'audit-1',
  runId: 'run-1' as ProviderRunId,
  sessionId: 'session-1' as SessionId,
  toolUseId: 'tool-1',
  toolName: 'Read',
  inputJson: '{}',
  decision: 'deny' as const,
  decidedBy,
  requestedAt: '2026-08-22T10:00:00.000Z' as IsoDateTime,
  decidedAt: '2026-08-22T10:00:00.000Z' as IsoDateTime,
});

let audited: AuditInput[];
let retries: RetryInput[];

const answerWith = ({ insertFails }: { readonly insertFails: boolean }) => {
  stubStoryInvoke({
    permission_audit_insert: ({ input }: { readonly input: AuditInput }) => {
      if (insertFails) {
        throw new Error('database is locked');
      }
      audited.push(input);
      return input;
    },
    permission_audit_retry_enqueue: ({ input }: { readonly input: RetryInput }) => {
      retries.push(input);
      return null;
    },
  });
};

beforeEach(() => {
  resetStorySpies();
  audited = [];
  retries = [];
  answerWith({ insertFails: false });
});

describe('persistPermissionAudit', () => {
  it('does not persist or enqueue default decisions', async () => {
    await persistPermissionAudit({ payload: makePayload('default') });

    expect(audited).toEqual([]);
    expect(retries).toEqual([]);
  });

  it('keeps explicit rule decisions', async () => {
    await persistPermissionAudit({ payload: makePayload('rule') });

    expect(audited).toEqual([
      expect.objectContaining({ id: 'audit-1', toolName: 'Read', decidedBy: 'rule' }),
    ]);
    expect(retries).toEqual([]);
  });

  it('queues the whole decision for a retry when the audit write fails', async () => {
    answerWith({ insertFails: true });
    const payload = makePayload('user');

    await persistPermissionAudit({ payload });

    expect(audited).toEqual([]);
    expect(retries.map((retry) => retry.id)).toEqual(['audit-1']);
    expect(JSON.parse(retries[0]?.payloadJson ?? '{}')).toEqual(payload);
  });
});
