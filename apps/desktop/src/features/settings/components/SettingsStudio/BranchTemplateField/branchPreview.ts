import { buildBranchName } from '@goodboy/core';
import { sessionBranchNaming } from '../../../../../store/slices/sessions/sessionBranchNaming';

type Params = {
  readonly template: string;
  readonly prefix: string;
  readonly user: string | null;
  readonly goal: string;
  readonly taskId: string | null;
};

export const branchPreview = ({ template, prefix, user, goal, taskId }: Params): string =>
  buildBranchName(
    sessionBranchNaming({
      template,
      prefix,
      user,
      goal,
      taskIdentifiers: taskId === null ? [] : [taskId],
    }),
  );
