import { getAutoTree } from '@goodboy/db';
import { currentAutoUserTurnPort } from '../../../features/auto/autoUserTurnPort';
import { tauriDatabase } from '../../../shared/lib/db';
import { nowIso } from '../project-mounts/nowIso';
import { sessionById } from '../sessions/sessionIndex';
import type { LimitStop } from './state';
import type { LimitStopsDeps } from './types';

type Params = Readonly<{
  get: LimitStopsDeps['get'];
  stop: LimitStop;
  message: string;
}>;

const UNDELIVERED_NOTE =
  "Auto didn't get word that this continuation didn't start. Tell Auto in its chat what happened.";

export const noticeAutoOfRefusedContinue = async ({
  get,
  stop,
  message,
}: Params): Promise<void> => {
  const autoChild = stop.autoChild;
  if (autoChild === undefined) {
    return;
  }
  const deliver = async (): Promise<boolean> => {
    const port = currentAutoUserTurnPort();
    const session = sessionById(get().sessions, stop.sessionId);
    if (port === null || session === undefined) {
      return false;
    }
    const tree = await getAutoTree({ db: tauriDatabase, treeId: autoChild.treeId });
    if (tree === null) {
      return false;
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
    return result === 'queued';
  };
  const isDelivered = await deliver().catch(() => false);
  if (isDelivered) {
    return;
  }
  get().appendTurnEvent(stop.agentId, stop.sessionId, {
    kind: 'error',
    runId: stop.runId,
    message: UNDELIVERED_NOTE,
    at: nowIso({}),
  });
};
