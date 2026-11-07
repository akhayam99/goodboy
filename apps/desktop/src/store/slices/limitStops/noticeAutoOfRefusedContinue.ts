import { getAutoTree } from '@goodboy/db';
import { currentAutoUserTurnPort } from '../../../features/auto/autoUserTurnPort';
import { tauriDatabase } from '../../../shared/lib/db';
import { sessionById } from '../sessions/sessionIndex';
import { resolveChildTurn } from '../turn/childTurn/resolveChildTurn';
import type { LimitStop } from './state';
import type { LimitStopsDeps } from './types';

type Params = Readonly<{
  get: LimitStopsDeps['get'];
  stop: LimitStop;
  message: string;
}>;

export const noticeAutoOfRefusedContinue = async ({
  get,
  stop,
  message,
}: Params): Promise<void> => {
  const port = currentAutoUserTurnPort();
  if (port === null) {
    return;
  }
  const resolution = await resolveChildTurn({ agentId: stop.agentId });
  if (resolution.kind !== 'child') {
    return;
  }
  const tree = await getAutoTree({ db: tauriDatabase, treeId: resolution.child.treeId });
  const session = sessionById(get().sessions, stop.sessionId);
  if (tree === null || session === undefined) {
    return;
  }
  const child = (get().sessionPhaseRuns[stop.sessionId] ?? []).find(
    (candidate) => candidate.id === stop.agentId,
  );
  const result = await port({
    agentId: tree.rootAgentId,
    sessionId: stop.sessionId,
    workspaceId: session.workspaceId,
    text: `The ${child?.name ?? 'agent'} you started stopped at its usage limit, and its continuation didn't start: ${message}`,
  });
  if (result === 'lost') {
    throw new Error("Auto didn't take the note about the continuation that didn't start.");
  }
};
