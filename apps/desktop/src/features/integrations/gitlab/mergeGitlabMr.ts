import { gitlabDefaultMergeMethodOf, isPullRequestPortError } from '@goodboy/core';
import type { PrMergeMethod, ProjectId, WorkspaceId } from '@goodboy/types';
import { gitlabPullRequestTransport } from './gitlabPullRequestTransport';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly projectId?: ProjectId;
  readonly host: string;
  readonly projectPath: string;
  readonly mrIid: number;
  readonly method?: PrMergeMethod;
  readonly expectedHeadSha: string | null;
};

type SettingsFailure = {
  readonly error: unknown;
};

const unreadableSettings = ({ error }: SettingsFailure): Promise<null> =>
  isPullRequestPortError(error) && error.kind === 'denied'
    ? Promise.resolve(null)
    : Promise.reject(error);

export const mergeGitlabMr = async ({
  method,
  expectedHeadSha,
  ...target
}: Params): Promise<void> => {
  const transport = gitlabPullRequestTransport(target);
  const chosen =
    method ??
    gitlabDefaultMergeMethodOf({
      settings: await transport.projectMergeSettings().then(
        (settings) => settings,
        (error: unknown) => unreadableSettings({ error }),
      ),
    });
  await transport.merge({ method: chosen, expectedHeadSha });
};
