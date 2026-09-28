import type { AgentId, SessionId } from '@goodboy/types';
import { deleteAttachment } from '../../../features/chat/turn';
import { abandonWorktreeWriter } from '../../../features/worktree/worktree';
import { agentDestinationPath, agentWritePaths } from '../resolve/agentWritePath';
import { recoverSoleMount } from '../project-mounts/recoverSoleMount';
import { selectWritableMounts } from '../project-mounts/selectors';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

export const releaseAgentFiles = async ({ get, sessionId, agentId }: Params): Promise<void> => {
  for (const path of await agentWritePaths({ get, sessionId, agentId })) {
    await abandonWorktreeWriter({ path, holder: agentId });
  }
  const sole = recoverSoleMount({ mounts: selectWritableMounts({ state: get(), sessionId }) });
  const worktree = agentDestinationPath({ get, agentId }) ?? sole?.worktreePath ?? null;
  if (worktree === null) {
    return;
  }
  for (const att of get().agentAttachments[agentId] ?? []) {
    await deleteAttachment(worktree, att.relPath).catch(() => undefined);
  }
};
