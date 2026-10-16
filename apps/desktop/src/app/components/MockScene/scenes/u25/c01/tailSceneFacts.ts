import { brandId, type ProviderRunId } from '@goodboy/types';
import { aView } from '../../../../../../features/auto/testing/autoViewFixtures';
import { agentTurnLive } from '../../../../../../features/live-state/adapters/agentTurnLive';
import { autoChildLive } from '../../../../../../features/live-state/adapters/autoChildLive';
import { autoTreeLive } from '../../../../../../features/live-state/adapters/autoTreeLive';
import { checkFixLive } from '../../../../../../features/live-state/adapters/checkFixLive';
import { cleanupLive } from '../../../../../../features/live-state/adapters/cleanupLive';
import { draftStartLive } from '../../../../../../features/live-state/adapters/draftStartLive';
import { fixRunLive } from '../../../../../../features/live-state/adapters/fixRunLive';
import { historyRewriteLive } from '../../../../../../features/live-state/adapters/historyRewriteLive';
import { processStopLive } from '../../../../../../features/live-state/adapters/processStopLive';
import { workflowRunLive } from '../../../../../../features/live-state/adapters/workflowRunLive';
import type { TailFacts } from '../../../../../../features/live-state/tailFacts';
import { sceneClock } from '../../../sceneClock';
import { TAIL_SCENE_STEP } from './tailSceneStep';

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
  | 'run'
  | 'cleanup'
  | 'cifix'
  | 'draft'
  | 'fixrun'
  | 'history'
  | 'stopping'
  | 'childstopped';

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
  run: () =>
    workflowRunLive({
      status: 'running',
      stepNumber: 3,
      stepCount: 4,
      roleNoun: 'Tester',
      stepAgentId: TAIL_SCENE_STEP.agentId,
      failure: null,
    }),
  cleanup: () =>
    cleanupLive({
      project: 'payments-api',
      isClosing: false,
      startedAt: null,
      failure: '2 uncommitted files.',
    }),
  cifix: () =>
    checkFixLive({
      checkName: 'test (payments-api)',
      turn: RUNNING,
      agent: AGENT,
      lastTool: PNPM,
      project: 'payments-api',
    }),
  draft: () => draftStartLive({ isStarting: false, startError: 'Claude Code is not connected.' }),
  fixrun: () => fixRunLive({ word: 'working', laneLine: 'Fixing 1 of 2', startedAt: STARTED }),
  history: () => historyRewriteLive({ phase: 'applying', startedAt: STARTED, failure: null }),
  stopping: () =>
    processStopLive({ name: 'pnpm dev', isStopping: false, hasTimedOut: true, failure: null }),
  childstopped: () =>
    autoChildLive({
      delegation: { state: 'settled', outcome: 'stopped', reason: null },
      turn: null,
      agent: { status: 'stopped', stoppedBy: 'app', stoppedAt: undefined },
      lastTool: null,
      project: null,
    }),
};

type Params = {
  readonly state: TailSceneState;
};

export const tailSceneFacts = ({ state }: Params): TailFacts | null => FACTS[state]();
