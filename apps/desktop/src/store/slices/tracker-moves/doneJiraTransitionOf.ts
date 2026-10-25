import type { JiraTransition } from '../../../features/integrations/jira/client';

type Params = {
  readonly transitions: ReadonlyArray<JiraTransition>;
};

const DONE_NAMES: ReadonlyArray<string> = ['done', 'closed', 'resolved', 'completed', 'complete'];

export const doneJiraTransitionOf = ({ transitions }: Params): JiraTransition | null => {
  for (const name of DONE_NAMES) {
    for (const transition of transitions) {
      if (transition.to !== null && transition.to.name.trim().toLowerCase() === name) {
        return transition;
      }
    }
  }
  return null;
};
