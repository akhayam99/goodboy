import { useAppStore } from '../../../../store';
import { WorkspaceAskPane } from './WorkspaceAskPane';

type Props = {
  readonly onClose: () => void;
};

export const WorkspaceAskHost = ({ onClose }: Props) => {
  const workspaceId = useAppStore((state) => state.currentWorkspaceId);
  if (workspaceId === null) {
    return null;
  }
  return <WorkspaceAskPane key={workspaceId} workspaceId={workspaceId} onClose={onClose} />;
};
