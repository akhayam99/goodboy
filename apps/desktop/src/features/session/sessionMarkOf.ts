import type { StatusMarkSpec } from '@goodboy/ui';
import type { SessionNode } from './sessionNode';
import { attentionMarkOf } from './attentionMarkOf';

type Params = {
  readonly node: SessionNode;
};

const QUESTION: StatusMarkSpec = { kind: 'state', state: 'question' };

const UNREAD: StatusMarkSpec = { kind: 'dot', tone: 'unread' };

const EMPTY: StatusMarkSpec = { kind: 'empty' };

export const sessionMarkOf = ({ node }: Params): StatusMarkSpec => {
  if (node.kind === 'needs' || node.kind === 'queue') {
    return node.reason === null ? QUESTION : attentionMarkOf({ reason: node.reason });
  }
  if (node.kind === 'running') {
    return { kind: 'state', state: 'running' };
  }
  if (node.hasUnread) {
    return UNREAD;
  }
  if (node.kind === 'done') {
    return { kind: 'state', state: node.isClosed ? 'closed' : 'merged' };
  }
  return EMPTY;
};
