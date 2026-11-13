import type { WorkspaceId } from '@goodboy/types';
import { useAppStore, useWorkspaces } from '../../../../../store';

type WorkspaceSwitchState = {
  readonly switchingToName: string | null;
  readonly failedName: string | null;
  readonly retry: () => void;
};

type NameParams = {
  readonly workspaces: ReturnType<typeof useWorkspaces>;
  readonly id: WorkspaceId | null;
};

const nameOf = ({ workspaces, id }: NameParams): string | null => {
  if (id === null) {
    return null;
  }
  return workspaces.find((workspace) => workspace.id === id)?.name ?? null;
};

export const useWorkspaceSwitchState = (): WorkspaceSwitchState => {
  const workspaces = useWorkspaces();
  const switchingToId = useAppStore((s) => s.switchingToWorkspaceId);
  const failedId = useAppStore((s) => s.workspaceSwitchError?.workspaceId ?? null);
  const setCurrentWorkspace = useAppStore((s) => s.setCurrentWorkspace);
  return {
    switchingToName: nameOf({ workspaces, id: switchingToId }),
    failedName: nameOf({ workspaces, id: failedId }),
    retry: () => {
      if (failedId !== null) {
        void setCurrentWorkspace({ id: failedId });
      }
    },
  };
};
