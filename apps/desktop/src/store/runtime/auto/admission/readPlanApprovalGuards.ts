import { isAdmissionPlanGateOn } from '@goodboy/core/auto';
import type { Database, GuardedStatement } from '@goodboy/db';
import type { AutoTreeId } from '@goodboy/types';
import { readAdmissionPermissions } from './readAdmissionPermissions';
import type { WriterInputRef } from './writerInputRefsOf';

type Params = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
  readonly refs: ReadonlyArray<WriterInputRef>;
  readonly isPlanApprovalRequired: boolean;
  readonly abortCode: string;
};

export const readPlanApprovalGuards = async ({
  db,
  treeId,
  refs,
  isPlanApprovalRequired,
  abortCode,
}: Params): Promise<ReadonlyArray<GuardedStatement>> => {
  const permissions = await readAdmissionPermissions({ db, treeId });
  if (!isAdmissionPlanGateOn({ isPlanApprovalRequired, permissions })) {
    return [];
  }
  return refs.map((ref) => ({
    sql: `SELECT 1 FROM auto_artifacts
      WHERE artifact_id = ? AND kind = 'plan'
        AND NOT (approval_state = 'approved' AND approved_revision IS ?)`,
    params: [ref.artifactId, ref.revision],
    abortWhen: 'rows',
    abortCode,
  }));
};
