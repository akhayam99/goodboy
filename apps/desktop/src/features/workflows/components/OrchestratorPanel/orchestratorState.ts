import { formatUsd } from '@goodboy/ui';
import type { Tone } from '@goodboy/ui';
import type {
  Agent,
  IsoDateTime,
  WorkflowOrchestrationStopKind,
  WorkflowRun,
} from '@goodboy/types';

type OrchestratorPhase =
  | 'deciding'
  | 'waiting'
  | 'automatic'
  | 'ready-first'
  | 'ready-mid'
  | 'needs-answer'
  | 'paused-budget'
  | 'blocked'
  | 'failed'
  | 'step-failed'
  | 'done';

export type OrchestratorState = {
  readonly phase: OrchestratorPhase;
  readonly tone: Tone;
  readonly sentence: string;
  readonly detail: string | null;
  readonly waitingSince: IsoDateTime | null;
};

type Params = {
  readonly run: WorkflowRun;
  readonly agents: ReadonlyArray<Agent>;
  readonly isOrchestrating: boolean;
  readonly hasOpenQuestions: boolean;
  readonly costUsd: number;
};

type StopPresentation = {
  readonly phase: OrchestratorPhase;
  readonly tone: Tone;
  readonly sentence: string;
  readonly showsMessage: boolean;
};

const STOP_PRESENTATION: Record<WorkflowOrchestrationStopKind, StopPresentation> = {
  budget: {
    phase: 'paused-budget',
    tone: 'warning',
    sentence: 'Paused · session budget cap reached',
    showsMessage: false,
  },
  failure: {
    phase: 'failed',
    tone: 'danger',
    sentence: 'Last decision failed',
    showsMessage: true,
  },
};

const isDone = (agent: Agent): boolean =>
  agent.status === 'completed' || agent.status === 'skipped';

export const resolveOrchestratorState = ({
  run,
  agents,
  isOrchestrating,
  hasOpenQuestions,
  costUsd,
}: Params): OrchestratorState => {
  const ordered = [...agents].sort((left, right) => left.ordinal - right.ordinal);
  const doneCount = ordered.filter(isDone).length;
  const base = { detail: null, waitingSince: null };

  if (isOrchestrating) {
    return { ...base, phase: 'deciding', tone: 'info', sentence: 'Choosing the next step' };
  }
  if (run.orchestrationOutcome === 'done') {
    const steps = `${ordered.length} ${ordered.length === 1 ? 'step' : 'steps'}`;
    return {
      ...base,
      phase: 'done',
      tone: 'success',
      sentence: `Run complete · ${steps} · ${formatUsd(costUsd)}`,
    };
  }
  if (run.orchestrationOutcome === 'blocked') {
    return {
      ...base,
      phase: 'blocked',
      tone: 'warning',
      sentence: 'Stopped · needs a human call',
      detail: run.orchestrationReason ?? null,
    };
  }
  const stop = run.orchestrationStop;
  if (stop != null) {
    const presentation = STOP_PRESENTATION[stop.kind];
    return {
      ...base,
      phase: presentation.phase,
      tone: presentation.tone,
      sentence: presentation.sentence,
      detail: presentation.showsMessage ? stop.message : null,
    };
  }
  const runningIndex = ordered.findIndex((agent) => agent.status === 'running');
  if (runningIndex >= 0) {
    const agent = ordered[runningIndex]!;
    return {
      ...base,
      phase: 'waiting',
      tone: 'neutral',
      sentence: `Waiting on step ${runningIndex + 1} · ${agent.name}`,
      waitingSince: agent.startedAt ?? null,
    };
  }
  if (hasOpenQuestions) {
    return {
      ...base,
      phase: 'needs-answer',
      tone: 'warning',
      sentence: 'Paused · an open question needs your answer',
    };
  }
  const failedIndex = ordered.findIndex((agent) => agent.status === 'failed');
  if (failedIndex >= 0) {
    const agent = ordered[failedIndex]!;
    return {
      ...base,
      phase: 'step-failed',
      tone: 'danger',
      sentence: `Stopped · step ${failedIndex + 1} failed · ${agent.name}`,
      detail: 'Automation stops here. Skip the step to let the orchestrator plan around it.',
    };
  }
  const pendingIndex = ordered.findIndex((agent) => agent.status === 'pending');
  if (pendingIndex >= 0) {
    const agent = ordered[pendingIndex]!;
    return {
      ...base,
      phase: 'waiting',
      tone: 'neutral',
      sentence: `Waiting on step ${pendingIndex + 1} · ${agent.name}`,
    };
  }
  if (run.autoRun) {
    return {
      ...base,
      phase: 'automatic',
      tone: 'info',
      sentence: 'Continuing automatically',
    };
  }
  if (ordered.length === 0) {
    return {
      ...base,
      phase: 'ready-first',
      tone: 'neutral',
      sentence: 'Ready to plan the first step',
    };
  }
  return {
    ...base,
    phase: 'ready-mid',
    tone: 'neutral',
    sentence: `Step ${doneCount} done · ready to continue`,
  };
};
