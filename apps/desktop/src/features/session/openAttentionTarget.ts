import { useAppStore } from '../../store';
import type { AttentionTarget } from './attentionTarget';
import { attentionTargetChannel } from './attentionTargetChannel';
import { landAttentionTarget, type AttentionLanding } from './landAttentionTarget';

export type AttentionOpening = AttentionLanding | 'elsewhere';

type Params = {
  readonly target: AttentionTarget;
};

export const openAttentionTarget = async ({ target }: Params): Promise<AttentionOpening> => {
  const store = useAppStore.getState();
  const { workspaceId } = target;
  if (workspaceId === null || workspaceId === store.currentWorkspaceId) {
    return landAttentionTarget({ target });
  }
  await attentionTargetChannel.send({ target });
  const workspace = store.workspaces.find((candidate) => candidate.id === workspaceId);
  await store.openWorkspace({
    id: workspaceId,
    title: workspace?.name ?? '',
    onRunning: 'new-window',
  });
  if (useAppStore.getState().currentWorkspaceId !== workspaceId) {
    return 'elsewhere';
  }
  const taken = attentionTargetChannel.take({ workspaceId, now: Date.now() });
  return taken === null ? 'elsewhere' : landAttentionTarget({ target: taken, isFreshOpen: true });
};
