import { listAutoWorkTreesOfWorkspace, type Database } from '@goodboy/db';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { readAutoTreeViews } from '../auto-view/readAutoTreeViews';
import type { WorkLead } from './state';

type Params = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
};

export const readWorkLeads = async ({
  db,
  workspaceId,
}: Params): Promise<ReadonlyArray<WorkLead>> => {
  const trees = await listAutoWorkTreesOfWorkspace({ db, workspaceId });
  const sessionIds = [...new Set(trees.map((tree) => tree.sessionId))];
  const viewsBySession = new Map(
    await Promise.all(
      sessionIds.map(
        async (sessionId: SessionId) =>
          [sessionId, await readAutoTreeViews({ db, sessionId })] as const,
      ),
    ),
  );
  return trees.flatMap((tree): ReadonlyArray<WorkLead> => {
    const view = viewsBySession
      .get(tree.sessionId)
      ?.find((candidate) => candidate.tree.id === tree.treeId);
    if (view === undefined) {
      return [];
    }
    return [{ ...tree, view }];
  });
};
