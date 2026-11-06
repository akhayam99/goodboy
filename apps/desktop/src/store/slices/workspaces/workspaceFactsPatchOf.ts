import type { AppState } from '../../types';
import { autoClockOf } from '../auto-view/autoClockOf';
import type { AutoViewState } from '../auto-view/state';
import type { WorkspaceFacts } from './loadWorkspaceFacts';

type FactsState = Pick<AppState, 'sessionOpenQuestions' | 'sessionDismissedNextSteps'> &
  Pick<AutoViewState, 'autoTreeViews' | 'autoClockAt'>;

type Params = {
  readonly state: FactsState;
  readonly facts: WorkspaceFacts;
  readonly now: number;
};

export const workspaceFactsPatchOf = ({ state, facts, now }: Params): FactsState => {
  const autoTreeViews = { ...state.autoTreeViews, ...facts.autoTreeViews };
  return {
    sessionOpenQuestions: { ...state.sessionOpenQuestions, ...facts.sessionOpenQuestions },
    sessionDismissedNextSteps: {
      ...state.sessionDismissedNextSteps,
      ...facts.sessionDismissedNextSteps,
    },
    autoTreeViews,
    autoClockAt: autoClockOf({
      views: Object.values(autoTreeViews).flat(),
      now,
      previous: state.autoClockAt,
    }),
  };
};
