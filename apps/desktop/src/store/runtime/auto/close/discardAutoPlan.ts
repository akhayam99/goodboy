import { getAutoArtifact, readAutoArtifactLiveState, type Database } from '@goodboy/db';
import type { ArtifactId, AutoTreeId } from '@goodboy/types';

export type DiscardAutoPlanOutcome =
  'discarded' | 'already_discarded' | 'unknown' | 'consumed' | 'revising';

type Params = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
  readonly artifactId: ArtifactId;
  readonly nowMs: number;
};

const ABORT = 'discard_refused';

export const discardAutoPlan = async ({
  db,
  treeId,
  artifactId,
  nowMs,
}: Params): Promise<DiscardAutoPlanOutcome> => {
  const registered = await getAutoArtifact({ db, artifactId });
  const live = await readAutoArtifactLiveState({ db, artifactId });
  if (registered === null || registered.treeId !== treeId || live === null) {
    return 'unknown';
  }
  if (live.status === 'discarded') {
    return 'already_discarded';
  }
  if (live.status === 'consumed') {
    return 'consumed';
  }
  if (registered.openReviseDelegationId !== null) {
    return 'revising';
  }
  const outcome = await db.transaction({
    statements: [
      {
        sql: `UPDATE session_artifacts SET status = 'discarded', updated_at = ?
          WHERE id = ? AND status = 'active'
            AND EXISTS (SELECT 1 FROM auto_artifacts
              WHERE artifact_id = ? AND tree_id = ? AND open_revise_delegation_id IS NULL)`,
        params: [nowMs, artifactId, artifactId, treeId],
        abortWhen: 'noChanges',
        abortCode: ABORT,
      },
      {
        sql: `UPDATE auto_delegations
          SET request_json = json_remove(request_json, '$.planDiscardAsk')
          WHERE id = ? AND json_extract(request_json, '$.planDiscardAsk.artifactId') = ?`,
        params: [registered.ownerDelegationId, artifactId],
      },
      {
        sql: 'UPDATE auto_artifacts SET rev = rev + 1 WHERE artifact_id = ?',
        params: [artifactId],
      },
      {
        sql: 'UPDATE auto_trees SET phase_rev = phase_rev + 1, updated_at = ? WHERE id = ?',
        params: [nowMs, treeId],
      },
    ],
  });
  if (outcome.status === 'committed') {
    return 'discarded';
  }
  const after = await readAutoArtifactLiveState({ db, artifactId });
  return after?.status === 'discarded' ? 'already_discarded' : 'revising';
};
