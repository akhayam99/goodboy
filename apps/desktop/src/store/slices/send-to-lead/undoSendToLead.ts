import type { AgentId, SessionId } from '@goodboy/types';
import { AUTO_STARTING_SENTENCE } from '../../../features/auto/autoStartingSentence';
import { currentTreeStopPort } from '../../../features/auto/treeStopPort';
import { currentWithdrawPort } from '../../../features/auto/withdrawPort';
import { pendingLeadRowOf } from '../../../features/work/sendToLead/pendingLeadRowOf';
import { SEND_TO_LEAD_COPY } from '../../../features/work/sendToLead/sendToLeadCopy';
import type { GetFn, SliceDeps } from '../../slice-types';
import type { AutoTreeView } from '../auto-view/state';
import { releaseSourceThread } from '../agentQueue/releaseSourceThread';
import type { SentToLead } from './state';
import type { SentKeyParams } from './types';
import { dropSentIfCurrent, patchSentIfCurrent } from './writeSent';

const NOT_THERE = 'The main window did not answer. Do it from the main window.';

type ViewsParams = Readonly<{
  get: GetFn;
  sessionId: SessionId;
}>;

const viewsOf = ({ get, sessionId }: ViewsParams): ReadonlyArray<AutoTreeView> => [
  ...(get().autoTreeViews[sessionId] ?? []),
  ...get().workLeads.map((lead) => lead.view),
];

type EntryParams = SliceDeps &
  Readonly<{
    entry: SentToLead;
    rootAgentId: AgentId;
  }>;

type FailParams = SliceDeps &
  Readonly<{
    entry: SentToLead;
    failure: string;
  }>;

const failUndo = ({ set, entry, failure }: FailParams): void => {
  patchSentIfCurrent({ set, key: entry.key, messageId: entry.messageId, patch: { failure } });
};

const stopNewLead = async ({ set, get, entry, rootAgentId }: EntryParams): Promise<void> => {
  const leadSessionId = entry.target.sessionId;
  await get().loadAutoTrees({ sessionId: leadSessionId });
  const view = viewsOf({ get, sessionId: leadSessionId }).find(
    (candidate) => candidate.tree.rootAgentId === rootAgentId,
  );
  const port = currentTreeStopPort();
  const result = view === undefined || port === null ? null : await port({ treeId: view.tree.id });
  if (result !== 'stopped') {
    failUndo({
      set,
      get,
      entry,
      failure: result === 'not_owner' ? NOT_THERE : AUTO_STARTING_SENTENCE,
    });
    return;
  }
  dropSentIfCurrent({ set, key: entry.key, messageId: entry.messageId });
};

const withdrawFromLead = async ({ set, get, entry, rootAgentId }: EntryParams): Promise<void> => {
  const leadSessionId = entry.target.sessionId;
  const queued = (get().agentQueue[rootAgentId] ?? []).find((item) => item.id === entry.messageId);
  if (queued !== undefined && queued.status !== 'sending') {
    const isRemoved = await get().removeQueuedMessage({
      sessionId: leadSessionId,
      agentId: rootAgentId,
      itemId: entry.messageId,
    });
    if (!isRemoved) {
      failUndo({ set, get, entry, failure: SEND_TO_LEAD_COPY.notTakenBack });
      return;
    }
    dropSentIfCurrent({ set, key: entry.key, messageId: entry.messageId });
    return;
  }
  const row = pendingLeadRowOf({
    views: viewsOf({ get, sessionId: leadSessionId }),
    rootAgentId,
    messageId: entry.messageId,
  });
  const port = currentWithdrawPort();
  if (row === null || entry.target.treeId === null) {
    return;
  }
  if (port === null) {
    failUndo({ set, get, entry, failure: AUTO_STARTING_SENTENCE });
    return;
  }
  const result = await port({ treeId: entry.target.treeId, rowId: row.rowId });
  if (result.kind === 'refused') {
    failUndo({ set, get, entry, failure: result.message });
    return;
  }
  if (result.kind === 'delivered') {
    return;
  }
  if (entry.threadId !== null) {
    await releaseSourceThread({
      set,
      get,
      sessionId: leadSessionId,
      agentId: rootAgentId,
      threadId: entry.threadId,
    });
  }
  dropSentIfCurrent({ set, key: entry.key, messageId: entry.messageId });
};

export const undoSendToLead = ({ set, get }: SliceDeps) => {
  return async ({ key }: SentKeyParams): Promise<void> => {
    const entry = get().sentToLead[key];
    if (entry === undefined) {
      return;
    }
    if (entry.phase === 'sending') {
      if (entry.isNew) {
        patchSentIfCurrent({ set, key, messageId: entry.messageId, patch: { isCancelled: true } });
      }
      return;
    }
    const { rootAgentId } = entry.target;
    if (entry.phase !== 'sent' || rootAgentId === null) {
      dropSentIfCurrent({ set, key, messageId: entry.messageId });
      return;
    }
    if (entry.isNew) {
      await stopNewLead({ set, get, entry, rootAgentId });
      return;
    }
    await withdrawFromLead({ set, get, entry, rootAgentId });
  };
};
