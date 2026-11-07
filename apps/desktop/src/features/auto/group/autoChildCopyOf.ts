import type { WorkNodeState } from '@goodboy/ui';
import { NAMES } from '../../../shared/utils/names';
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
  running: { node: 'running', word: NAMES.running, isDanger: false, fallback: NAMES.running },
  done: { node: 'done', word: NAMES.done, isDanger: false, fallback: NAMES.done },
  failed: { node: 'failed', word: NAMES.failed, isDanger: true, fallback: NAMES.failed },
  stopped: { node: 'skipped', word: NAMES.stopped, isDanger: false, fallback: NAMES.stopped },
  timedOut: { node: 'failed', word: NAMES.failed, isDanger: true, fallback: 'Timed out' },
  blocked: { node: 'alert', word: NAMES.needsYou, isDanger: false, fallback: NAMES.needsYou },
  neverStarted: {
    node: 'failed',
    word: NAMES.notStarted,
    isDanger: true,
    fallback: 'Never started',
  },
  retried: { node: 'skipped', word: 'Retried', isDanger: false, fallback: 'Retried' },
  queued: { node: 'queued', word: NAMES.queued, isDanger: false, fallback: NAMES.queued },
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
  const shouldShowReason = STATE_COPY[child.state].isDanger || child.state === 'blocked';
  return shouldShowReason && child.reason !== null ? child.reason : askedOf({ child });
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
