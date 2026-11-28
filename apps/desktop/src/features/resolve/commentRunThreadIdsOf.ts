import type { Agent } from '@goodboy/types';
import { agentThreadIds } from '../session/agentThreadIds';
import { isRunningCommentRun } from './isRunningCommentRun';

type Params = {
  readonly agents: ReadonlyArray<Agent> | undefined;
};

export const commentRunThreadIdsOf = ({ agents }: Params): ReadonlyArray<string> =>
  [
    ...new Set(
      (agents ?? [])
        .filter((agent) => isRunningCommentRun({ agent }))
        .flatMap((agent) => agentThreadIds(agent)),
    ),
  ].sort();
