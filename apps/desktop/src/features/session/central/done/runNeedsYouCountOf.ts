import type { TimelineAgentEntry } from '../../timeline/buildTimelineGroups';

type Params = {
  readonly steps: ReadonlyArray<TimelineAgentEntry>;
};

export const runNeedsYouCountOf = ({ steps }: Params): number =>
  steps.filter(
    (step) =>
      step.openQuestions.length > 0 ||
      step.agent.status === 'failed' ||
      step.agent.status === 'blocked',
  ).length;
