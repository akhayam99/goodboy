import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import type { SentToLead } from '../../../store/slices/send-to-lead/state';
import { sessionById } from '../../../store/slices/sessions/sessionIndex';
import type { SendToLeadItem } from '../../../store/slices/send-to-lead/types';
import { AUTO_CONFINED_ROLE } from '../../../store/slices/turn/confinedRoleOf';
import { leadRouteOf } from '../../session/startRun/routeChoiceOf';
import { RUN_ROUTE_COPY } from '../../session/startRun/runRouteCopy';
import { startRoutedRun } from '../../session/startRun/startRoutedRun';

type Params = {
  readonly item: SendToLeadItem;
};

type LaunchedParams = {
  readonly sessionId: SessionId;
  readonly before: ReadonlySet<AgentId>;
};

const launchedLeadOf = ({ sessionId, before }: LaunchedParams): AgentId | null =>
  (useAppStore.getState().sessionPhaseRuns[sessionId] ?? []).find(
    (agent) =>
      agent.kind === AUTO_CONFINED_ROLE &&
      agent.parentAgentId === undefined &&
      !before.has(agent.id),
  )?.id ?? null;

export const startNewLead = async ({ item }: Params): Promise<void> => {
  const { sessions, sentToLead, sessionPhaseRuns, recordSentToLead, patchSentToLead } =
    useAppStore.getState();
  if (sentToLead[item.key]?.phase === 'sending') {
    return;
  }
  const title = sessionById(sessions, item.sessionId)?.goal ?? '';
  const entry: SentToLead = {
    ...item,
    target: { treeId: null, rootAgentId: null, sessionId: item.sessionId, title },
    isNew: true,
    isCancelled: false,
    messageId: crypto.randomUUID(),
    phase: 'sending',
    failure: null,
  };
  const before = new Set((sessionPhaseRuns[item.sessionId] ?? []).map((agent) => agent.id));
  recordSentToLead({ entry });
  const patch = await startRoutedRun({
    sessionId: item.sessionId,
    result: {
      route: leadRouteOf({ row: 1, why: RUN_ROUTE_COPY.why.picked }),
      ask: item.text,
      preset: null,
      role: null,
    },
    sourceThreadIds: item.threadId === null ? [] : [item.threadId],
    sourceMountId: item.mountId,
  }).then(
    (run): Partial<SentToLead> =>
      run.kind === 'lead'
        ? { phase: 'sent', target: { ...entry.target, rootAgentId: run.agentId } }
        : { phase: 'failed', failure: null },
    (error: unknown): Partial<SentToLead> => {
      const launched = launchedLeadOf({ sessionId: item.sessionId, before });
      if (launched !== null) {
        return { phase: 'sent', target: { ...entry.target, rootAgentId: launched } };
      }
      return { phase: 'failed', failure: error instanceof Error ? error.message : String(error) };
    },
  );
  patchSentToLead({ key: entry.key, messageId: entry.messageId, patch });
  const latest = useAppStore.getState().sentToLead[entry.key];
  if (latest?.messageId !== entry.messageId || !latest.isCancelled) {
    return;
  }
  await useAppStore.getState().undoSendToLead({ key: entry.key });
};
