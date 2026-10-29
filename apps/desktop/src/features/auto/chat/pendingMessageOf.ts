import { AUTO_BLOCK_TEXT, parseAutoDelegationRole } from '@goodboy/core';
import { AGENT_KIND_META, kindForRole } from '../../session/agent-kind';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { taskTitleOf } from '../taskTitleOf';

export type PendingMessageAction = 'sendNow' | 'raiseLimit' | 'retry';

export type PendingMessageLine = Readonly<{
  tone: 'waits' | 'notDelivered';
  text: string;
  action: PendingMessageAction | null;
}>;

type Params = {
  readonly view: AutoTreeView;
};

const STOPPED_REASON = 'Auto was stopped.';

const waitingForOf = ({ view }: Params): string => {
  const open = view.delegations.filter(
    (delegation) => delegation.state !== 'settled' && !delegation.isAdopted,
  );
  const [only] = open;
  if (open.length === 1 && only !== undefined) {
    const role = parseAutoDelegationRole({ role: only.role });
    const noun = role === null ? 'agent' : AGENT_KIND_META[kindForRole({ role })].noun;
    return taskTitleOf({ request: only.request }) ?? `the ${noun}`;
  }
  return `${open.length} agents`;
};

const hasOpenChild = ({ view }: Params): boolean =>
  view.delegations.some((delegation) => delegation.state !== 'settled' && !delegation.isAdopted);

export const pendingMessageLineOf = ({ view }: Params): PendingMessageLine | null => {
  const { phase, blockedReason } = view.tree;
  if (phase === 'waiting') {
    if (!hasOpenChild({ view })) {
      return null;
    }
    return { tone: 'waits', text: `Waits for ${waitingForOf({ view })}`, action: 'sendNow' };
  }
  if (phase === 'stopping' || phase === 'stopped') {
    return { tone: 'notDelivered', text: `Not delivered: ${STOPPED_REASON}`, action: null };
  }
  if (phase !== 'blocked') {
    return null;
  }
  const reason =
    blockedReason === null || blockedReason === '' ? 'Auto is blocked.' : blockedReason;
  const text = `Not delivered: ${reason}`;
  if (blockedReason === AUTO_BLOCK_TEXT.budget) {
    return { tone: 'notDelivered', text, action: 'raiseLimit' };
  }
  if (blockedReason === AUTO_BLOCK_TEXT.limit_wall_clock) {
    return { tone: 'notDelivered', text, action: null };
  }
  return { tone: 'notDelivered', text, action: 'retry' };
};
