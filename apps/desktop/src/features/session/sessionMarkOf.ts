import type { StatusMarkSpec, StatusMarkState } from '@goodboy/ui';
import type { SessionNode } from './sessionNode';

type Params = {
  readonly node: SessionNode;
};

const ASK_STATES: Readonly<Partial<Record<SessionNode['state'], StatusMarkState>>> = {
  question: 'question',
  approval: 'approval',
  budget: 'budget',
  alert: 'alert',
  failed: 'failed',
  ready: 'ready',
  merging: 'merging',
  approved: 'approved',
};

const UNREAD: StatusMarkSpec = { kind: 'dot', tone: 'unread' };

const EMPTY: StatusMarkSpec = { kind: 'empty' };

export const sessionMarkOf = ({ node }: Params): StatusMarkSpec => {
  if (node.kind === 'needs' || node.kind === 'queue') {
    const state = ASK_STATES[node.state];
    if (state !== undefined) {
      return { kind: 'state', state };
    }
    return node.hasUnread ? UNREAD : { kind: 'dot', tone: node.tone };
  }
  if (node.kind === 'running') {
    return { kind: 'state', state: 'running' };
  }
  if (node.hasUnread) {
    return UNREAD;
  }
  if (node.kind === 'done') {
    return { kind: 'state', state: node.state === 'closed' ? 'closed' : 'merged' };
  }
  return EMPTY;
};
