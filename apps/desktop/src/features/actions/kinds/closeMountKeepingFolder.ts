import type { ActionEnv } from '../types';
import type { MountFacts } from './mountFacts';

type Params = {
  readonly facts: MountFacts;
  readonly env: ActionEnv;
};

export const closeMountKeepingFolder = async ({ facts, env }: Params): Promise<void> => {
  await env.getState().unmountMount({
    sessionId: facts.sessionId,
    mountId: facts.mountId,
    keepDirectory: true,
  });
  if (facts.worktreePath !== null) {
    env.showToast({ kind: 'info', message: `Folder kept at ${facts.worktreePath}` });
  }
};
