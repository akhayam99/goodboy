import type { AgentId, SessionId } from '@goodboy/types';
import { invokeAgentList } from '../../../features/workflows/workflows';
import { SEND_TO_LEAD_COPY } from '../../../features/work/sendToLead/sendToLeadCopy';
import type { GetFn, SliceDeps } from '../../slice-types';
import { releaseSourceThread } from '../agentQueue/releaseSourceThread';
import { bindThread } from './bindThread';
import { isLeadStillOpen } from './isLeadStillOpen';
import type { SentToLead } from './state';
import { patchSentIfCurrent, writeSent } from './writeSent';

type DeliverParams = SliceDeps &
  Readonly<{
    entry: SentToLead;
  }>;

type Delivered = Pick<SentToLead, 'phase' | 'failure'>;

const SENT: Delivered = { phase: 'sent', failure: null };

const STOPPED: Delivered = { phase: 'stopped', failure: SEND_TO_LEAD_COPY.notDelivered };

const NOT_SAVED: Delivered = { phase: 'failed', failure: SEND_TO_LEAD_COPY.notSaved };

const NOT_FOUND: Delivered = { phase: 'failed', failure: SEND_TO_LEAD_COPY.leadNotFound };

type CurrentParams = Readonly<{
  get: GetFn;
  entry: SentToLead;
}>;

const isCurrent = ({ get, entry }: CurrentParams): boolean =>
  get().sentToLead[entry.key]?.messageId === entry.messageId;

type RootParams = Readonly<{
  get: GetFn;
  sessionId: SessionId;
  agentId: AgentId;
}>;

const hasRoot = ({ get, sessionId, agentId }: RootParams): boolean =>
  (get().sessionPhaseRuns[sessionId] ?? []).some((agent) => agent.id === agentId);

const loadRoot = async ({
  set,
  get,
  sessionId,
  agentId,
}: SliceDeps & RootParams): Promise<boolean> => {
  if (hasRoot({ get, sessionId, agentId })) {
    return true;
  }
  const listed = await invokeAgentList(sessionId);
  set((state) => ({ sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: listed } }));
  return hasRoot({ get, sessionId, agentId });
};

const deliver = async ({ set, get, entry }: DeliverParams): Promise<Delivered | null> => {
  const { treeId, rootAgentId, sessionId: leadSessionId } = entry.target;
  if (treeId === null || rootAgentId === null) {
    return STOPPED;
  }
  if (!(await isLeadStillOpen({ get, sessionId: entry.sessionId, treeId }))) {
    return STOPPED;
  }
  if (!(await loadRoot({ set, get, sessionId: leadSessionId, agentId: rootAgentId }))) {
    return NOT_FOUND;
  }
  if (!isCurrent({ get, entry })) {
    return null;
  }
  const bound =
    entry.threadId === null
      ? 'held'
      : await bindThread({
          set,
          get,
          sessionId: leadSessionId,
          agentId: rootAgentId,
          threadId: entry.threadId,
        });
  if (bound === 'refused') {
    return STOPPED;
  }
  const release = async (): Promise<void> => {
    if (bound === 'bound' && entry.threadId !== null) {
      await releaseSourceThread({
        set,
        get,
        sessionId: leadSessionId,
        agentId: rootAgentId,
        threadId: entry.threadId,
      });
    }
  };
  if (!isCurrent({ get, entry })) {
    await release();
    return null;
  }
  const isSaved = await get().enqueueAgentMessage({
    turn: {
      id: entry.messageId,
      agentId: rootAgentId,
      content: entry.text,
      attachments: [],
      override: undefined,
      ...(entry.threadId !== null && { sourceThreadId: entry.threadId }),
    },
    shouldDropUnsaved: true,
  });
  if (!isSaved) {
    await release();
    return NOT_SAVED;
  }
  void get().drainAgentQueue({ sessionId: leadSessionId, agentId: rootAgentId });
  return SENT;
};

export const deliverToLead = async ({ set, get, entry }: DeliverParams): Promise<void> => {
  if (get().sentToLead[entry.key]?.phase === 'sending') {
    return;
  }
  writeSent({ set, entry: { ...entry, phase: 'sending', failure: null } });
  const outcome = await deliver({ set, get, entry }).catch((error: unknown): Delivered => ({
    phase: 'failed',
    failure: error instanceof Error ? error.message : SEND_TO_LEAD_COPY.notSaved,
  }));
  if (outcome === null) {
    return;
  }
  patchSentIfCurrent({ set, key: entry.key, messageId: entry.messageId, patch: outcome });
};
