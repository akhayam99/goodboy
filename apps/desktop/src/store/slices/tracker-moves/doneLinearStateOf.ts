import type { LinearWorkflowState } from '../../../features/integrations/linear/client';

type Params = {
  readonly states: ReadonlyArray<LinearWorkflowState>;
};

const COMPLETED = 'completed';

const PREFERRED_NAME = 'done';

export const doneLinearStateOf = ({ states }: Params): LinearWorkflowState | null => {
  const completed = states
    .filter((state) => state.type === COMPLETED)
    .sort((left, right) => left.position - right.position);
  for (const state of completed) {
    if (state.name.trim().toLowerCase() === PREFERRED_NAME) {
      return state;
    }
  }
  return completed[0] ?? null;
};
