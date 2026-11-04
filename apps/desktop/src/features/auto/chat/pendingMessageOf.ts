import { AUTO_BLOCK_TEXT, parseAutoDelegationRole } from '@goodboy/core/auto';
import { AGENT_KIND_META, kindForRole } from '../../session/agent-kind';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { taskTitleOf } from '../taskTitleOf';

export type PendingMessageAction = 'sendNow' | 'raiseLimit' | 'retry';

export type PendingMessageLine = Readonly<{
  tone: 'waits' | 'notDelivered';
  text: string;
  reason: string | null;
  action: PendingMessageAction | null;
}>;

type Params = {
  readonly view: AutoTreeView;
};

const STOPPED_REASON = 'Auto was stopped.';

const NOT_DELIVERED = 'Not delivered';

const WAITS_FOR_TURN = 'Waits for this turn';

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

export const pendingMessageLineOf = ({ view }: Params): PendingMessageLine => {
  const { phase, blockedReason } = view.tree;
  if (phase === 'waiting' && hasOpenChild({ view })) {
    return {
      tone: 'waits',
      text: `Waits for ${waitingForOf({ view })}`,
      reason: null,
      action: 'sendNow',
    };
  }
  if (phase === 'stopping' || phase === 'stopped') {
    return { tone: 'notDelivered', text: NOT_DELIVERED, reason: STOPPED_REASON, action: null };
  }
  if (phase !== 'blocked') {
    return { tone: 'waits', text: WAITS_FOR_TURN, reason: null, action: null };
  }
  const reason =
    blockedReason === null || blockedReason === '' ? 'Auto is blocked.' : blockedReason;
  if (blockedReason === AUTO_BLOCK_TEXT.budget) {
    return { tone: 'notDelivered', text: NOT_DELIVERED, reason, action: 'raiseLimit' };
  }
  if (blockedReason === AUTO_BLOCK_TEXT.limit_wall_clock) {
    return { tone: 'notDelivered', text: NOT_DELIVERED, reason, action: null };
  }
  return { tone: 'notDelivered', text: NOT_DELIVERED, reason, action: 'retry' };
};
