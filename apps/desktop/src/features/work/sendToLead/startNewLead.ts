import { useAppStore } from '../../../store';
import type { SentToLead } from '../../../store/slices/send-to-lead/state';
import { sessionById } from '../../../store/slices/sessions/sessionIndex';
import type { SendToLeadItem } from '../../../store/slices/send-to-lead/types';
import { leadRouteOf } from '../../session/startRun/routeChoiceOf';
import { RUN_ROUTE_COPY } from '../../session/startRun/runRouteCopy';
import { startRoutedRun } from '../../session/startRun/startRoutedRun';

type Params = {
  readonly item: SendToLeadItem;
};

export const startNewLead = async ({ item }: Params): Promise<void> => {
  const { sessions, recordSentToLead, patchSentToLead } = useAppStore.getState();
  const title = sessionById(sessions, item.sessionId)?.goal ?? '';
  const entry: SentToLead = {
    ...item,
    target: { treeId: null, rootAgentId: null, sessionId: item.sessionId, title },
    isNew: true,
    messageId: crypto.randomUUID(),
    phase: 'sending',
    failure: null,
  };
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
    (error: unknown): Partial<SentToLead> => ({
      phase: 'failed',
      failure: error instanceof Error ? error.message : String(error),
    }),
  );
  patchSentToLead({ key: entry.key, messageId: entry.messageId, patch });
};
