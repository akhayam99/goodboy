import type { IsoDateTime, PermissionAuditEntry, TaskId, WorkspaceId } from '@kay-am/types';

export interface AuditQuery {
  readonly taskId?: TaskId;
  readonly workspaceId?: WorkspaceId;
  readonly fromAt?: IsoDateTime;
  readonly toAt?: IsoDateTime;
  readonly limit?: number;
}

export interface AuditRecorderDeps {
  readonly insert: (entry: PermissionAuditEntry) => Promise<void>;
  readonly list: (q: AuditQuery) => Promise<ReadonlyArray<PermissionAuditEntry>>;
  readonly clear: (scope: { taskId?: TaskId; workspaceId?: WorkspaceId }) => Promise<void>;
}

export class PermissionAuditRecorder {
  constructor(private readonly deps: AuditRecorderDeps) {}

  record(entry: PermissionAuditEntry): Promise<void> {
    return this.deps.insert(entry);
  }

  query(q: AuditQuery): Promise<ReadonlyArray<PermissionAuditEntry>> {
    return this.deps.list(q);
  }

  clear(scope: { taskId?: TaskId; workspaceId?: WorkspaceId }): Promise<void> {
    if (!scope.taskId && !scope.workspaceId) {
      throw new Error('clear scope required: taskId or workspaceId');
    }
    return this.deps.clear(scope);
  }
}
