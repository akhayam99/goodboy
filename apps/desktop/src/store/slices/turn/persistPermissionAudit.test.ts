import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, ProviderRunId, SessionId } from '@goodboy/types';

const { invokeAuditRetryEnqueue, invokePermissionAuditInsert } = vi.hoisted(() => ({
  invokeAuditRetryEnqueue: vi.fn(async () => undefined),
  invokePermissionAuditInsert: vi.fn(async () => undefined),
}));

vi.mock('../../../features/permissions/permissions', () => ({
  invokeAuditRetryEnqueue,
  invokePermissionAuditInsert,
}));

import { persistPermissionAudit } from './persistPermissionAudit';

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('persistPermissionAudit', () => {
  it('does not persist or enqueue default decisions', async () => {
    await persistPermissionAudit({ payload: makePayload('default') });

    expect(invokePermissionAuditInsert).not.toHaveBeenCalled();
    expect(invokeAuditRetryEnqueue).not.toHaveBeenCalled();
  });

  it('keeps explicit rule decisions', async () => {
    const payload = makePayload('rule');

    await persistPermissionAudit({ payload });

    expect(invokePermissionAuditInsert).toHaveBeenCalledWith(payload);
  });
});
