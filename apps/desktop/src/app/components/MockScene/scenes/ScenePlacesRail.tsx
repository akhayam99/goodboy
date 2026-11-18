import { useAppStore } from '../../../../store';
import { shellArrangement } from '../../../shellArrangement';
import { ShellLeft } from '../../ShellLeft';
import { SCENE_COLUMN_ACTIONS } from './sceneColumnActions';

export const ScenePlacesRail = () => {
  const workspaceId = useAppStore((state) => state.currentWorkspaceId);
  return (
    <ShellLeft
      arrangement={shellArrangement({ hasWorkspace: workspaceId !== null })}
      workspaceId={workspaceId}
      actions={SCENE_COLUMN_ACTIONS}
    />
  );
};
