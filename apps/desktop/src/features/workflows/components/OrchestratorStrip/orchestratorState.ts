import { isAgentStatusHalted, isAgentStatusSettled } from '@goodboy/core';
import { formatUsd } from '@goodboy/ui';
import type { Tone } from '@goodboy/ui';
import type { Agent, AgentId, WorkflowOrchestrationStopKind, WorkflowRun } from '@goodboy/types';
import { ORCHESTRATOR_DECIDING_SENTENCE } from '../../orchestratorCopy';
import { isRunPaused } from '../../isRunPaused';

type OrchestratorPhase =
  | 'deciding'
  | 'paused'
  | 'stopping'
  | 'waiting'
  | 'automatic'
  | 'ready-first'
  | 'ready-mid'
  | 'needs-answer'
  | 'paused-budget'
  | 'blocked'
  | 'needs-approval'
  | 'failed'
  | 'step-failed'
  | 'stopped'
  | 'done';

export type OrchestratorState = {
  readonly phase: OrchestratorPhase;
  readonly tone: Tone;
  readonly sentence: string;
  readonly detail: string | null;
  readonly waitingOnAgentId: AgentId | null;
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
    sentence: 'Paused at the spend limit',
    showsMessage: false,
  },
  failure: {
    phase: 'failed',
    tone: 'danger',
    sentence: 'Last decision failed',
    showsMessage: true,
  },
  questions: {
    phase: 'needs-answer',
    tone: 'neutral',
    sentence: 'Paused for your answer',
    showsMessage: false,
  },
  operator: {
    phase: 'stopped',
    tone: 'warning',
    sentence: 'Stopped by you · the step in flight was skipped',
    showsMessage: true,
  },
  closed: {
    phase: 'done',
    tone: 'neutral',
    sentence: 'Closed by you',
    showsMessage: false,
  },
  'needs-approval': {
    phase: 'needs-approval',
    tone: 'warning',
    sentence: 'Paused · needs your approval',
    showsMessage: true,
  },
  paused: {
    phase: 'paused',
    tone: 'warning',
    sentence: 'Paused by you',
    showsMessage: false,
  },
};

type PausedParams = {
  readonly ordered: ReadonlyArray<Agent>;
};

const pausedDetail = ({ ordered }: PausedParams): string => {
  const running = ordered.find((agent) => agent.status === 'running');
  if (running != null) {
    return `${running.name} finishes its turn. Nothing new starts until you resume. The pause survives a restart.`;
  }
  const next = ordered.find((agent) => agent.status === 'pending');
  if (next != null) {
    return `Nothing new starts until you resume. Next: ${next.name}.`;
  }
  return 'Nothing new starts until you resume.';
};

const OPERATOR_STOP_IN_FLIGHT: StopPresentation = {
  phase: 'stopping',
  tone: 'warning',
  sentence: 'Stopping · waiting for the decision already in flight',
  showsMessage: false,
};

const UNKNOWN_STOP: StopPresentation = {
  phase: 'failed',
  tone: 'danger',
  sentence: 'Stopped · reason not recognized',
  showsMessage: true,
};

export const resolveOrchestratorState = ({
  run,
  agents,
  isOrchestrating,
  hasOpenQuestions,
  costUsd,
}: Params): OrchestratorState => {
  const ordered = [...agents].sort((left, right) => left.ordinal - right.ordinal);
  const doneCount = ordered.filter((agent) =>
    isAgentStatusSettled({ status: agent.status }),
  ).length;
  const base = { detail: null, waitingOnAgentId: null };

  if (isOrchestrating && run.orchestrationStop?.kind === 'operator') {
    return {
      ...base,
      phase: OPERATOR_STOP_IN_FLIGHT.phase,
      tone: OPERATOR_STOP_IN_FLIGHT.tone,
      sentence: OPERATOR_STOP_IN_FLIGHT.sentence,
    };
  }
  if (isRunPaused({ run })) {
    return {
      ...base,
      phase: STOP_PRESENTATION.paused.phase,
      tone: STOP_PRESENTATION.paused.tone,
      sentence: STOP_PRESENTATION.paused.sentence,
      detail: pausedDetail({ ordered }),
    };
  }
  if (isOrchestrating) {
    return {
      ...base,
      phase: 'deciding',
      tone: 'info',
      sentence: ORCHESTRATOR_DECIDING_SENTENCE,
    };
  }
  if (run.orchestrationStop?.kind === 'closed') {
    const steps = `${ordered.length} ${ordered.length === 1 ? 'step' : 'steps'}`;
    return {
      ...base,
      phase: STOP_PRESENTATION.closed.phase,
      tone: STOP_PRESENTATION.closed.tone,
      sentence: `${STOP_PRESENTATION.closed.sentence} · ${steps} · ${formatUsd(costUsd)}`,
    };
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
    };
  }
  const stop = run.orchestrationStop;
  const isAnsweredQuestionStop = stop?.kind === 'questions' && hasOpenQuestions === false;
  if (stop != null && isAnsweredQuestionStop === false) {
    const known: StopPresentation | undefined = STOP_PRESENTATION[stop.kind];
    const presentation = known ?? UNKNOWN_STOP;
    const isSpendStop = stop.kind === 'budget' && stop.message.startsWith('Paused at the ');
    return {
      ...base,
      phase: presentation.phase,
      tone: presentation.tone,
      sentence: isSpendStop ? stop.message : presentation.sentence,
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
      waitingOnAgentId: agent.id,
    };
  }
  if (hasOpenQuestions) {
    return {
      ...base,
      phase: 'needs-answer',
      tone: 'neutral',
      sentence: 'Paused for your answer',
    };
  }
  const haltedIndex = ordered.findIndex((agent) => isAgentStatusHalted({ status: agent.status }));
  if (haltedIndex >= 0) {
    const isBlocked = ordered[haltedIndex]?.status === 'blocked';
    return {
      ...base,
      phase: 'step-failed',
      tone: 'neutral',
      sentence: `Paused on ${isBlocked ? 'blocked' : 'failed'} step ${haltedIndex + 1}`,
    };
  }
  const stoppedIndex = ordered.findIndex((agent) => agent.status === 'stopped');
  if (stoppedIndex >= 0) {
    const agent = ordered[stoppedIndex]!;
    const by = agent.stoppedBy === 'app' ? 'by restart' : 'by you';
    return {
      ...base,
      phase: 'waiting',
      tone: 'neutral',
      sentence: `Step ${stoppedIndex + 1} stopped ${by} · ${agent.name}`,
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
  if (run.autoRun === false) {
    return {
      ...base,
      phase: 'ready-mid',
      tone: 'neutral',
      sentence: 'Waiting for your go',
    };
  }
  return {
    ...base,
    phase: 'ready-mid',
    tone: 'neutral',
    sentence: `Step ${doneCount} done · ready to continue`,
  };
};
