import {
  invokeAuditRetryEnqueue,
  invokePermissionAuditInsert,
  type PermissionAuditInsertPayload,
} from '../../../features/permissions/permissions';

type Params = {
  readonly payload: PermissionAuditInsertPayload;
};

export const persistPermissionAudit = async ({ payload }: Params): Promise<void> => {
  if (payload.decidedBy === 'default') {
    return;
  }
  try {
    await invokePermissionAuditInsert(payload);
  } catch {
    try {
      await invokeAuditRetryEnqueue(payload.id ?? crypto.randomUUID(), JSON.stringify(payload));
    } catch (enqueueError) {
      console.error('permission audit retry enqueue failed', enqueueError);
    }
  }
};
