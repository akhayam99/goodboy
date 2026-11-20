import { describe, expect, it } from 'vitest';
import { AUTO_BLOCK_TEXT, AUTO_STALE_DECIDE_TEXT, LEGACY_GATE_TEXTS } from '@goodboy/core/auto';
import { autoTreeLive } from '../live-state/adapters/autoTreeLive';
import { TAIL_ACTION } from '../live-state/tailAction';
import type { AutoTreeView } from '../../store/slices/auto-view/state';
import { pendingMessageLineOf } from './chat/pendingMessageOf';
import { aView } from './testing/autoViewFixtures';

type BlockedParams = {
  readonly reason: string;
};

const blockedView = ({ reason }: BlockedParams): AutoTreeView => {
  const view = aView({ phase: 'blocked' });
  return { ...view, tree: { ...view.tree, blockedReason: reason } };
};

const tailOf = ({ reason }: BlockedParams) =>
  autoTreeLive({
    view: blockedView({ reason }),
    rootTurn: null,
    rootAgent: { status: 'completed' },
    lastTool: null,
    project: null,
  });

const CASES = [
  {
    name: 'budget',
    stored: LEGACY_GATE_TEXTS.budget,
    shown: AUTO_BLOCK_TEXT.budget,
    action: 'raiseLimit',
  },
  {
    name: 'no progress',
    stored: LEGACY_GATE_TEXTS.noProgress,
    shown: AUTO_BLOCK_TEXT.limit_no_progress,
    action: 'retry',
  },
  {
    name: 'returns',
    stored: LEGACY_GATE_TEXTS.returns,
    shown: 'Agents came back to the Lead 6 times in 30 minutes.',
    action: 'retry',
  },
  {
    name: 'stale decide',
    stored: LEGACY_GATE_TEXTS.staleDecide,
    shown: AUTO_STALE_DECIDE_TEXT,
    action: 'retry',
  },
  {
    name: 'refusal',
    stored: `${LEGACY_GATE_TEXTS.refusedPrefix} and was refused: the folder is busy. Retry to let it choose again, or tell it what to change.`,
    shown:
      'The Lead kept trying to start agents and was refused: the folder is busy. Retry to let it choose again, or tell it what to change.',
    action: 'retry',
  },
] as const;

describe('a block stored by an older build reads in the current words', () => {
  it.each(CASES)('$name keeps its action and shows the Lead copy', ({ stored, shown, action }) => {
    const tail = tailOf({ reason: stored });
    const line = pendingMessageLineOf({ view: blockedView({ reason: stored }) });

    expect(tail?.phrase).toBe(shown);
    expect(tail?.actions[0]).toBe(
      action === 'raiseLimit' ? TAIL_ACTION.raiseLimit : TAIL_ACTION.retry,
    );
    expect(line).toMatchObject({ reason: shown, action });
    expect(tail?.phrase).not.toContain('Auto');
  });
});
