import type { Agent, WorkflowRun } from '@goodboy/types';
import { isRunPaused } from './isRunPaused';

type Params = {
  readonly run: WorkflowRun;
  readonly agent: Agent;
  readonly agents: ReadonlyArray<Agent>;
};

const SKIP_BODY =
  'Its turn is cancelled and the step is marked Skipped. Its changes stay in the worktree.';

const nextNameOf = ({ agent, agents }: Omit<Params, 'run'>): string | null =>
  [...agents]
    .filter(
      (candidate) =>
        candidate.parentAgentId == null &&
        candidate.status === 'pending' &&
        candidate.ordinal > agent.ordinal,
    )
    .sort((left, right) => left.ordinal - right.ordinal)[0]?.name ?? null;

export const skipStepTitle = ({ agent }: Pick<Params, 'agent'>): string => `Skip ${agent.name}?`;

export const skipStepDescription = ({ run, agent, agents }: Params): string => {
  const next = nextNameOf({ agent, agents });
  if (isRunPaused({ run })) {
    return `${SKIP_BODY} Nothing new starts until you resume.`;
  }
  if (next === null && run.executionMode !== 'dynamic') {
    return `${SKIP_BODY} It was the last step.`;
  }
  if (next === null) {
    return run.autoRun === true
      ? `${SKIP_BODY} The orchestrator decides what comes next.`
      : `${SKIP_BODY} You choose when the orchestrator decides what comes next.`;
  }
  if (run.autoRun !== true) {
    return `${SKIP_BODY} You choose when ${next} starts.`;
  }
  return `${SKIP_BODY} The run moves on to ${next}.`;
};
