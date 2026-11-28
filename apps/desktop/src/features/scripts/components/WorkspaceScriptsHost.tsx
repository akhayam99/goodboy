import type { ProjectId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { LazyWorkspaceScriptsDrawer } from './LazyWorkspaceScriptsDrawer';

type Props = {
  readonly projectId: ProjectId | null;
  readonly onClose: () => void;
};

export const WorkspaceScriptsHost = ({ projectId, onClose }: Props) => {
  const workspaceId = useAppStore((state) => state.currentWorkspaceId);
  if (workspaceId === null) {
    return null;
  }
  return (
    <LazyWorkspaceScriptsDrawer
      key={workspaceId}
      workspaceId={workspaceId}
      projectId={projectId}
      onClose={onClose}
    />
  );
};
