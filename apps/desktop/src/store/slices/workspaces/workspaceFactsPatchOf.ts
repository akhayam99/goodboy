import type { AppState } from '../../types';
import type { AutoViewState } from '../auto-view/state';
import type { WorkspaceFacts } from './loadWorkspaceFacts';

type FactsState = Pick<AppState, 'sessionOpenQuestions' | 'sessionDismissedNextSteps'> &
  Pick<AutoViewState, 'autoTreeViews'>;

type Params = {
  readonly state: FactsState;
  readonly facts: WorkspaceFacts;
};

export const workspaceFactsPatchOf = ({ state, facts }: Params): FactsState => ({
  sessionOpenQuestions: { ...state.sessionOpenQuestions, ...facts.sessionOpenQuestions },
  sessionDismissedNextSteps: {
    ...state.sessionDismissedNextSteps,
    ...facts.sessionDismissedNextSteps,
  },
  autoTreeViews: { ...state.autoTreeViews, ...facts.autoTreeViews },
});
