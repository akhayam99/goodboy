import type { WorkNodeState } from '@goodboy/ui';
import { formatClock } from '../../../shared/utils/time/formatClock';
import type { AutoChildState, AutoGroupChild } from '../autoGroupOf';

export type AutoChildCopy = Readonly<{
  node: WorkNodeState;
  word: string;
  isDanger: boolean;
  isLive: boolean;
  text: string;
  sub: string | null;
}>;

type StateCopy = Readonly<{
  node: WorkNodeState;
  word: string;
  isDanger: boolean;
  fallback: string;
}>;

const STATE_COPY: Readonly<Record<AutoChildState, StateCopy>> = {
  running: { node: 'running', word: 'Working', isDanger: false, fallback: 'Working' },
  done: { node: 'done', word: 'Done', isDanger: false, fallback: 'Done' },
  failed: { node: 'failed', word: 'Failed', isDanger: true, fallback: 'Failed' },
  timedOut: { node: 'failed', word: 'Timed out', isDanger: true, fallback: 'Timed out' },
  blocked: { node: 'failed', word: 'Blocked', isDanger: true, fallback: 'Blocked' },
  neverStarted: {
    node: 'failed',
    word: 'Never started',
    isDanger: true,
    fallback: 'Never started',
  },
  retried: { node: 'skipped', word: 'Retried', isDanger: false, fallback: 'Retried' },
  queued: { node: 'queued', word: 'Queued', isDanger: false, fallback: 'Queued' },
};

type ChildParams = {
  readonly child: AutoGroupChild;
};

const askedOf = ({ child }: ChildParams): string | null =>
  child.asked === null ? null : `Auto asked: ${child.asked}`;

const subOf = ({ child }: ChildParams): string | null => {
  if (child.state === 'neverStarted' && child.createdAt !== null) {
    return `Auto created it at ${formatClock({ at: child.createdAt })}, no first message reached it.`;
  }
  if (child.state === 'done') {
    return null;
  }
  const isDanger = STATE_COPY[child.state].isDanger;
  return isDanger && child.reason !== null ? child.reason : askedOf({ child });
};

export const autoChildCopyOf = ({ child }: ChildParams): AutoChildCopy => {
  const copy = STATE_COPY[child.state];
  return {
    node: copy.node,
    word: copy.word,
    isDanger: copy.isDanger,
    isLive: child.state === 'running',
    text: child.outcome ?? copy.fallback,
    sub: subOf({ child }),
  };
};
