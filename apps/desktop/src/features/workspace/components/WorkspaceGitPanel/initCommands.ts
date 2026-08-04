import type { WorkspaceGitState } from '@goodboy/types';

export type InitCommand = {
  readonly title: string;
  readonly detail: string;
  readonly command: string;
};

type Params = {
  readonly rootPath: string;
  readonly state: WorkspaceGitState;
};

export const initCommands = ({ rootPath, state }: Params): ReadonlyArray<InitCommand> => {
  const at = `git -C "${rootPath}"`;
  const commit: InitCommand = {
    title: 'Make the first commit',
    detail:
      'Write a .gitignore first so secrets and build output stay out. A session branches off this commit, so what you commit is what an agent starts from.',
    command: `${at} add -A && ${at} commit -m "chore: initial commit"`,
  };
  const remote: InitCommand = {
    title: 'Add a remote (optional)',
    detail: 'Only needed to push and open pull requests. Local work runs without one.',
    command: `${at} remote add origin <your-remote-url>`,
  };
  if (state === 'unborn') {
    return [commit, remote];
  }
  return [
    {
      title: 'Create the repository',
      detail: 'Runs in the project folder, never inside a session worktree.',
      command: `${at} init -b main`,
    },
    commit,
    remote,
  ];
};
