import type { WorkflowOrchestrationStop } from '@goodboy/types';
import type { OrchestratorPhase } from './orchestratorState';
import { runPrimaryOf, type RunPrimary } from './runPrimaryOf';

type Params = {
  readonly stop: WorkflowOrchestrationStop | null | undefined;
  readonly primary: RunPrimary | null;
};

type PhaseParams = {
  readonly phase: OrchestratorPhase;
};

const primaryOfPhase = ({ phase }: PhaseParams): RunPrimary | null =>
  runPrimaryOf({
    isDiscarded: false,
    isFinished: false,
    isQueuedManual: false,
    hold: 'none',
    flow: { kind: 'dynamic', phase, hasQuestion: false, isAutoRun: true },
  });

export const runQuestionsActionOf = ({ stop, primary }: Params): RunPrimary | null => {
  if (stop == null) {
    return null;
  }
  switch (stop.kind) {
    case 'budget':
      return primaryOfPhase({ phase: 'paused-budget' });
    case 'failure':
      return primaryOfPhase({ phase: 'failed' });
    case 'operator':
      return primaryOfPhase({ phase: 'stopped' });
    case 'closed':
    case 'paused':
      return primaryOfPhase({ phase: 'paused' });
    case 'plan-approval':
      return primary?.kind === 'review-plan' || primary?.kind === 'approve-plan' ? primary : null;
    case 'questions':
    case 'needs-approval':
    case 'preset-change':
      return null;
    default: {
      const exhaustive: never = stop.kind;
      return exhaustive;
    }
  }
};
