import { describe, expect, it } from 'vitest';
import type {
  IsoDateTime,
  PermissionAuditEntry,
  PermissionDecision,
  PermissionRequest,
  PermissionRequestId,
  PermissionRuleId,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { PermissionAuditRecorder, type AuditQuery } from './audit';

const AT = '2024-01-01T00:00:00.000Z' as IsoDateTime;
const SESSION = 'session-1' as SessionId;
const WS = 'ws-1' as WorkspaceId;

function makeEntry(id: string): PermissionAuditEntry {
  const request: PermissionRequest = {
    id: id as PermissionRequestId,
    runId: 'run-1' as never,
    toolUseId: 'tool-use-1',
    toolName: 'Edit',
    input: {},
    at: AT,
  };
  const decision: PermissionDecision = {
    requestId: id as PermissionRequestId,
    decision: 'allow',
    ruleId: null,
    decidedBy: 'default',
    at: AT,
  };
  return { request, decision };
}

function makeInMemoryDeps() {
  const store: PermissionAuditEntry[] = [];
  return {
    deps: {
      insert: async (entry: PermissionAuditEntry) => {
        store.push(entry);
      },
      list: async (_q: AuditQuery) => [...store] as ReadonlyArray<PermissionAuditEntry>,
      clear: async (_scope: { sessionId?: SessionId; workspaceId?: WorkspaceId }) => {
        store.splice(0, store.length);
      },
    },
    store,
  };
}

describe('PermissionAuditRecorder', () => {
  it('record → query round-trip via in-memory deps', async () => {
    const { deps } = makeInMemoryDeps();
    const recorder = new PermissionAuditRecorder(deps);

    const entry = makeEntry('req-1');
    await recorder.record(entry);

    const results = await recorder.query({});
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(entry);
  });

  it('clear without scope throws', async () => {
    const { deps } = makeInMemoryDeps();
    const recorder = new PermissionAuditRecorder(deps);

    expect(() => recorder.clear({})).toThrow('clear scope required: sessionId or workspaceId');
  });

  it('clear without scope throws even with undefined values', () => {
    const { deps } = makeInMemoryDeps();
    const recorder = new PermissionAuditRecorder(deps);

    expect(() => recorder.clear({ sessionId: undefined, workspaceId: undefined })).toThrow(
      'clear scope required: sessionId or workspaceId',
    );
  });

  it('clear with sessionId only succeeds', async () => {
    const { deps } = makeInMemoryDeps();
    const recorder = new PermissionAuditRecorder(deps);

    await recorder.record(makeEntry('req-1'));
    await expect(recorder.clear({ sessionId: SESSION })).resolves.toBeUndefined();
  });

  it('clear with workspaceId only succeeds', async () => {
    const { deps } = makeInMemoryDeps();
    const recorder = new PermissionAuditRecorder(deps);

    await recorder.record(makeEntry('req-1'));
    await expect(recorder.clear({ workspaceId: WS })).resolves.toBeUndefined();
  });

  it('record multiple entries → query returns all', async () => {
    const { deps } = makeInMemoryDeps();
    const recorder = new PermissionAuditRecorder(deps);

    await recorder.record(makeEntry('req-1'));
    await recorder.record(makeEntry('req-2'));
    await recorder.record(makeEntry('req-3'));

    const results = await recorder.query({});
    expect(results).toHaveLength(3);
  });
});
