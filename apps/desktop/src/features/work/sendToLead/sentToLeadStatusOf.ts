import type { AgentQueuedTurn } from '../../../store/slices/agentQueue/types';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import type { SentToLead } from '../../../store/slices/send-to-lead/state';
import { pendingLeadRowOf } from './pendingLeadRowOf';

export type SentToLeadStatus =
  | Readonly<{ kind: 'sending' }>
  | Readonly<{ kind: 'starting' }>
  | Readonly<{ kind: 'notRead' }>
  | Readonly<{ kind: 'onIt' }>
  | Readonly<{ kind: 'stopped' }>
  | Readonly<{ kind: 'failed'; failure: string }>;

type Params = {
  readonly entry: SentToLead;
  readonly queue: ReadonlyArray<AgentQueuedTurn>;
  readonly views: ReadonlyArray<AutoTreeView>;
};

const ENDED_PHASES: ReadonlySet<string> = new Set(['stopping', 'stopped']);

export const sentToLeadStatusOf = ({ entry, queue, views }: Params): SentToLeadStatus => {
  if (entry.phase === 'sending') {
    return { kind: entry.isNew ? 'starting' : 'sending' };
  }
  if (entry.phase === 'failed') {
    return { kind: 'failed', failure: entry.failure ?? '' };
  }
  if (entry.phase === 'stopped') {
    return { kind: 'stopped' };
  }
  const { rootAgentId } = entry.target;
  if (rootAgentId === null) {
    return { kind: 'starting' };
  }
  const view = views.find((candidate) => candidate.tree.rootAgentId === rootAgentId) ?? null;
  if (entry.isNew) {
    return view === null || view.tree.turnsUsed === 0 ? { kind: 'starting' } : { kind: 'onIt' };
  }
  const queued = queue.find((item) => item.id === entry.messageId);
  const isPending =
    queued !== undefined || pendingLeadRowOf({ views, rootAgentId, text: entry.text }) !== null;
  if (!isPending) {
    return { kind: 'onIt' };
  }
  if (view !== null && ENDED_PHASES.has(view.tree.phase)) {
    return { kind: 'stopped' };
  }
  if (queued?.hold !== undefined) {
    return { kind: 'failed', failure: queued.hold.reason };
  }
  return { kind: 'notRead' };
};
