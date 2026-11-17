import type { Database } from '@goodboy/db';
import type { ArtifactId, AutoDelegationId, AutoTreeId } from '@goodboy/types';

export type KeepAutoPlanBaseOutcome = 'kept' | 'refused';

type Params = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
  readonly delegationId: AutoDelegationId;
  readonly artifactId: ArtifactId;
  readonly revision: number;
  readonly nowMs: number;
};

const ABORT = 'keep_refused';

export const keepAutoPlanBase = async ({
  db,
  treeId,
  delegationId,
  artifactId,
  revision,
  nowMs,
}: Params): Promise<KeepAutoPlanBaseOutcome> => {
  const outcome = await db.transaction({
    statements: [
      {
        sql: `UPDATE auto_delegations
          SET request_json = json_set(request_json, '$.keptBase', json(?))
          WHERE id = ? AND tree_id = ? AND state = 'settled'
            AND outcome IN ('failed', 'timed_out', 'blocked')
            AND EXISTS (SELECT 1 FROM auto_artifacts a
              JOIN session_artifacts s ON s.id = a.artifact_id
              WHERE a.artifact_id = ? AND a.tree_id = ? AND a.open_revise_delegation_id IS NULL
                AND s.status = 'active' AND s.revision = ?)`,
        params: [
          JSON.stringify({ artifactId, revision }),
          delegationId,
          treeId,
          artifactId,
          treeId,
          revision,
        ],
        abortWhen: 'noChanges',
        abortCode: ABORT,
      },
      {
        sql: 'UPDATE auto_trees SET phase_rev = phase_rev + 1, updated_at = ? WHERE id = ?',
        params: [nowMs, treeId],
      },
    ],
  });
  return outcome.status === 'committed' ? 'kept' : 'refused';
};
