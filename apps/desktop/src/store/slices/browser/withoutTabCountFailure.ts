import type { WorkspaceId } from '@goodboy/types';
import type { BrowserState } from './state';

type Params = {
  readonly failures: BrowserState['browserTabCountFailures'];
  readonly workspaceId: WorkspaceId;
};

export const withoutTabCountFailure = ({ failures, workspaceId }: Params): Params['failures'] => {
  if (failures[workspaceId] === undefined) {
    return failures;
  }
  const next = { ...failures };
  delete next[workspaceId];
  return next;
};
