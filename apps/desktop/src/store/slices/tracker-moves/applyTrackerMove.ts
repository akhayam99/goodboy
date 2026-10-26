import { linearUpdateIssueState } from '../../../features/integrations/linear/client';
import {
  jiraListTransitions,
  jiraTransitionIssue,
} from '../../../features/integrations/jira/client';
import { jiraConfigOf } from './jiraConfigOf';
import type { GetFn, TrackerMove } from './types';

type Params = {
  readonly get: GetFn;
  readonly move: TrackerMove;
  readonly direction: 'forward' | 'back';
};

const projectScope = ({ move }: Pick<Params, 'move'>) =>
  move.projectId === null ? {} : { projectId: move.projectId };

export const applyTrackerMove = async ({ get, move, direction }: Params): Promise<void> => {
  const { target } = move;
  if (target.kind === 'linear') {
    await linearUpdateIssueState({
      workspaceId: move.workspaceId,
      issueId: move.externalId,
      stateId: direction === 'forward' ? target.stateId : target.fromStateId,
      ...projectScope({ move }),
    });
    return;
  }
  const config = jiraConfigOf({ get, workspaceId: move.workspaceId });
  if (config === null) {
    throw new Error('Jira is not connected to this workspace.');
  }
  const issue = {
    workspaceId: move.workspaceId,
    ...projectScope({ move }),
    siteUrl: config.siteUrl,
    email: config.email,
    issueKey: move.identifier,
  };
  if (direction === 'forward') {
    await jiraTransitionIssue({ ...issue, transitionId: target.transitionId });
    return;
  }
  const wanted = move.fromName.trim().toLowerCase();
  const back = (await jiraListTransitions(issue)).find(
    (transition) => transition.to !== null && transition.to.name.trim().toLowerCase() === wanted,
  );
  if (back === undefined) {
    throw new Error(`Jira has no way back to ${move.fromName} from ${move.toName}.`);
  }
  await jiraTransitionIssue({ ...issue, transitionId: back.id });
};
