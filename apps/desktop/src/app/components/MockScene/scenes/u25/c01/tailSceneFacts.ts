import { brandId, type ProviderRunId } from '@goodboy/types';
import { aView } from '../../../../../../features/auto/testing/autoViewFixtures';
import { agentTurnLive } from '../../../../../../features/live-state/adapters/agentTurnLive';
import { autoChildLive } from '../../../../../../features/live-state/adapters/autoChildLive';
import { autoTreeLive } from '../../../../../../features/live-state/adapters/autoTreeLive';
import { TAIL_ACTION } from '../../../../../../features/live-state/tailAction';
import type { TailFacts } from '../../../../../../features/live-state/tailFacts';
import { sceneClock } from '../../../sceneClock';

const CLOCK = sceneClock({ anchor: '2026-10-16T09:01:12.000Z' });
const STARTED = CLOCK.iso({ at: '2026-10-16T09:00:00.000Z' });
const RUN = brandId<ProviderRunId>({ value: 'run-harborline' });
const RUNNING = { kind: 'running', runId: RUN, startedAt: STARTED } as const;
const AGENT = { status: 'running', stoppedBy: undefined, stoppedAt: undefined } as const;
const PNPM = { name: 'Bash', command: 'pnpm test --filter payments-api', path: null };
const EDIT = { name: 'Edit', command: null, path: 'src/ledger/export.ts' };

export type TailSceneState =
  | 'working'
  | 'waiting'
  | 'queued'
  | 'paused'
  | 'failed'
  | 'stopped'
  | 'childstopped'
  | 'childconfirm'
  | 'childasked'
  | 'agentstopping'
  | 'agentstalled';

const FACTS: Record<TailSceneState, () => TailFacts | null> = {
  working: () =>
    agentTurnLive({
      turn: RUNNING,
      agent: AGENT,
      lastTool: PNPM,
      project: 'payments-api',
      hasQueuedMessage: false,
    }),
  waiting: () =>
    autoTreeLive({
      view: aView({ phase: 'waiting' }),
      rootTurn: null,
      rootAgent: AGENT,
      lastTool: null,
      project: null,
    }),
  queued: () =>
    agentTurnLive({
      turn: RUNNING,
      agent: AGENT,
      lastTool: EDIT,
      project: 'payments-api',
      hasQueuedMessage: true,
    }),
  paused: () =>
    autoTreeLive({
      view: aView({ phase: 'waiting', spentUsd: 4.8, reservedUsd: 0.2, capUsd: 5 }),
      rootTurn: null,
      rootAgent: AGENT,
      lastTool: null,
      project: null,
    }),
  failed: () =>
    agentTurnLive({
      turn: {
        kind: 'error',
        message: 'the provider exited without a response.',
        failedAt: STARTED,
      },
      agent: AGENT,
      lastTool: null,
      project: null,
      hasQueuedMessage: false,
    }),
  stopped: () =>
    agentTurnLive({
      turn: null,
      agent: { status: 'stopped', stoppedBy: 'you', stoppedAt: undefined },
      lastTool: null,
      project: null,
      hasQueuedMessage: false,
    }),
  agentstopping: () => ({
    state: 'stopping',
    phrase: 'Stopping',
    startedAt: STARTED,
    actions: [{ ...TAIL_ACTION.stop, isBusy: true }],
  }),
  agentstalled: () => ({
    state: 'stopping',
    phrase: 'Still stopping',
    startedAt: STARTED,
    actions: [TAIL_ACTION.forceStop],
  }),
  childstopped: () =>
    autoChildLive({
      delegation: { state: 'settled', outcome: 'stopped', reason: null },
      turn: null,
      agent: { status: 'stopped', stoppedBy: 'app', stoppedAt: undefined },
      lastTool: null,
      project: null,
    }),
  childconfirm: () =>
    autoChildLive({
      delegation: { state: 'awaiting_confirm', outcome: null, reason: null },
      turn: null,
      agent: AGENT,
      lastTool: null,
      project: null,
    }),
  childasked: () =>
    autoChildLive({
      delegation: { state: 'paused', outcome: null, reason: null },
      turn: { kind: 'blocked', runId: RUN, blockedAt: STARTED },
      agent: AGENT,
      lastTool: null,
      project: null,
    }),
};

type Params = {
  readonly state: TailSceneState;
};

export const tailSceneFacts = ({ state }: Params): TailFacts | null => FACTS[state]();
