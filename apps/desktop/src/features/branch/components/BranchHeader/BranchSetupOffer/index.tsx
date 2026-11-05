import type { MountId, SessionId } from '@goodboy/types';
import { WorktreeSetupOffer } from '../../../../worktree/WorktreeSetupOffer';
import { useAppStore } from '../../../../../store';
import { projectById } from '../../../../../store/slices/projects/projectIndex';
import { selectMountById } from '../../../../../store/slices/project-mounts/selectors';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
};

export const BranchSetupOffer = ({ sessionId, mountId }: Props) => {
  const worktreePath = useAppStore(
    (state) => selectMountById({ state, sessionId, mountId })?.worktreePath ?? null,
  );
  const branch = useAppStore(
    (state) => selectMountById({ state, sessionId, mountId })?.branch ?? '',
  );
  const isAttached = useAppStore(
    (state) => selectMountById({ state, sessionId, mountId })?.isAttached ?? false,
  );
  const projectName = useAppStore((state) => {
    const mount = selectMountById({ state, sessionId, mountId });
    return mount === null
      ? ''
      : (projectById(state.projects, mount.projectId)?.name ?? mount.mountName);
  });
  if (!isAttached || worktreePath === null || worktreePath === '') {
    return null;
  }
  return (
    <WorktreeSetupOffer
      sessionId={sessionId}
      mountId={mountId}
      worktreePath={worktreePath}
      projectName={projectName}
      branch={branch}
    />
  );
};
