import type { WorkflowAutonomy } from '@goodboy/types';
import type { AgentKind } from '../../../session/agent-kind';

export type PausePoint = {
  readonly afterIndex: number;
  readonly text: string;
};

type Params = {
  readonly autonomy: WorkflowAutonomy;
  readonly kinds: ReadonlyArray<AgentKind>;
};

const CONTINUE_TEXT = 'Waits for you to continue';
const APPROVE_PLAN_TEXT = 'Waits for you to approve the plan';

export const pausePointsOf = ({ autonomy, kinds }: Params): ReadonlyArray<PausePoint> => {
  if (autonomy === 'run') {
    return [];
  }
  if (autonomy === 'step') {
    return kinds
      .slice(0, -1)
      .map((_, index): PausePoint => ({ afterIndex: index, text: CONTINUE_TEXT }));
  }
  const planIndex = kinds.findIndex((kind) => kind === 'planner');
  if (planIndex === -1 || planIndex === kinds.length - 1) {
    return [];
  }
  return [{ afterIndex: planIndex, text: APPROVE_PLAN_TEXT }];
};
