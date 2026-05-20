import type { IsoDateTime, PermissionAuditEntry, SessionId, WorkspaceId } from '@goodboy/types';

export interface AuditQuery {
  readonly sessionId?: SessionId;
  readonly workspaceId?: WorkspaceId;
  readonly fromAt?: IsoDateTime;
  readonly toAt?: IsoDateTime;
  readonly limit?: number;
}

export interface AuditRecorderDeps {
  readonly insert: (entry: PermissionAuditEntry) => Promise<void>;
  readonly list: (q: AuditQuery) => Promise<ReadonlyArray<PermissionAuditEntry>>;
  readonly clear: (scope: { sessionId?: SessionId; workspaceId?: WorkspaceId }) => Promise<void>;
}

export class PermissionAuditRecorder {
  constructor(private readonly deps: AuditRecorderDeps) {}

  record(entry: PermissionAuditEntry): Promise<void> {
    return this.deps.insert(entry);
  }

  query(q: AuditQuery): Promise<ReadonlyArray<PermissionAuditEntry>> {
    return this.deps.list(q);
  }

  clear(scope: { sessionId?: SessionId; workspaceId?: WorkspaceId }): Promise<void> {
    if (!scope.sessionId && !scope.workspaceId) {
      throw new Error('clear scope required: sessionId or workspaceId');
    }
    return this.deps.clear(scope);
  }
}
