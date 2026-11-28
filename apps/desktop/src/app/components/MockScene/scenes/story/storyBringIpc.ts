import type { InvokeArgs } from '@tauri-apps/api/core';
import type { WorkspaceGitStatus } from '@goodboy/types';
import { setupSceneAnswer } from '../onboarding/setupSceneAnswer';
import { storyIpcAnswer } from './storyIpc';

type Params = {
  readonly command: string;
  readonly payload: InvokeArgs | undefined;
  readonly isLanded: boolean;
};

const ABSENT_GIT_STATUS = {
  state: 'absent',
  branch: null,
  headSubject: null,
  upstreamDistance: { kind: 'unknown', reason: 'rev-list-failed' },
  workingTree: { kind: 'unknown', reason: 'status-read-failed' },
  upstream: null,
  inProgress: null,
} as const satisfies WorkspaceGitStatus;

const KEY_CHECK_MS = 900;

type AfterParams = {
  readonly read: () => unknown;
};

const afterKeyCheck = ({ read }: AfterParams): Promise<unknown> =>
  new Promise((resolve, reject) => {
    window.setTimeout(() => {
      try {
        resolve(read());
      } catch (error) {
        reject(error);
      }
    }, KEY_CHECK_MS);
  });

export const storyBringAnswer = ({ command, payload, isLanded }: Params): unknown => {
  if (command === 'linear_validate_connection') {
    return afterKeyCheck({ read: () => storyIpcAnswer({ command, payload }) });
  }
  const story = storyIpcAnswer({ command, payload });
  if (story !== undefined || isLanded) {
    return story;
  }
  if (command === 'worktree_remote_url') {
    return 'git@github.com:harborline/payments-api.git';
  }
  if (command === 'project_git_status') {
    return ABSENT_GIT_STATUS;
  }
  return setupSceneAnswer({ command, payload });
};
