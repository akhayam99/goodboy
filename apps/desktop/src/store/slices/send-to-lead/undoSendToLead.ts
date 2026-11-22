import type { AgentId, SessionId } from '@goodboy/types';
import { AUTO_STARTING_SENTENCE } from '../../../features/auto/autoStartingSentence';
import { currentTreeStopPort } from '../../../features/auto/treeStopPort';
import { currentWithdrawPort } from '../../../features/auto/withdrawPort';
import { pendingLeadRowOf } from '../../../features/work/sendToLead/pendingLeadRowOf';
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

const stopNewLead = async ({ set, get, entry, rootAgentId }: EntryParams): Promise<void> => {
  const leadSessionId = entry.target.sessionId;
  await get().loadAutoTrees({ sessionId: leadSessionId });
  const view = viewsOf({ get, sessionId: leadSessionId }).find(
    (candidate) => candidate.tree.rootAgentId === rootAgentId,
  );
  const port = currentTreeStopPort();
  const result = view === undefined || port === null ? null : await port({ treeId: view.tree.id });
  if (result !== 'stopped') {
    patchSentIfCurrent({
      set,
      key: entry.key,
      messageId: entry.messageId,
      patch: { failure: result === 'not_owner' ? NOT_THERE : AUTO_STARTING_SENTENCE },
    });
    return;
  }
  dropSentIfCurrent({ set, key: entry.key, messageId: entry.messageId });
};

const withdrawFromLead = async ({ set, get, entry, rootAgentId }: EntryParams): Promise<void> => {
  const leadSessionId = entry.target.sessionId;
  const queued = (get().agentQueue[rootAgentId] ?? []).find((item) => item.id === entry.messageId);
  if (queued !== undefined && queued.status !== 'sending') {
    await get().removeQueuedMessage({
      sessionId: leadSessionId,
      agentId: rootAgentId,
      itemId: entry.messageId,
    });
    dropSentIfCurrent({ set, key: entry.key, messageId: entry.messageId });
    return;
  }
  const row = pendingLeadRowOf({
    views: viewsOf({ get, sessionId: leadSessionId }),
    rootAgentId,
    text: entry.text,
  });
  const port = currentWithdrawPort();
  if (row === null || entry.target.treeId === null) {
    return;
  }
  if (port === null) {
    patchSentIfCurrent({
      set,
      key: entry.key,
      messageId: entry.messageId,
      patch: { failure: AUTO_STARTING_SENTENCE },
    });
    return;
  }
  const result = await port({ treeId: entry.target.treeId, rowId: row.rowId });
  if (result.kind === 'refused') {
    patchSentIfCurrent({
      set,
      key: entry.key,
      messageId: entry.messageId,
      patch: { failure: result.message },
    });
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
    if (entry === undefined || entry.phase === 'sending') {
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
