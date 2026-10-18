import { useCallback } from 'react';
import type { Workspace } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { usePickFolder } from '../../../../../shared/hooks/usePickFolder';
import { useShowToast } from '../../../../../shared/components/Toast/useShowToast';
import { undoable } from '../../../../../shared/utils/undoable';
import { openSettings } from '../../../../settings/openSettings';

type Params = {
  readonly workspace: Workspace | null;
};

const openFolders = (): void => {
  openSettings({ scope: 'workspace', section: 'projects' });
};

export const useAddFolderHere = ({ workspace }: Params): (() => Promise<void>) => {
  const pickFolder = usePickFolder();
  const addProject = useAppStore((state) => state.addProject);
  const removeProject = useAppStore((state) => state.removeProject);
  const reportError = useAppStore((state) => state.reportError);
  const showToast = useShowToast();
  const workspaceId = workspace?.id ?? null;
  const workspaceName = workspace?.name ?? '';

  return useCallback(async () => {
    if (workspaceId === null) {
      return;
    }
    const picked = await pickFolder();
    if (picked === null) {
      return;
    }
    try {
      const result = await addProject({ workspaceId, rootPath: picked });
      if (result.kind === 'conflict') {
        showToast({
          kind: 'warning',
          title: `${result.conflict.project.name} belongs to ${result.conflict.sourceWorkspace.name}`,
          message: `Move it to ${workspaceName} from the workspace folders.`,
          action: { label: 'Open folders', onClick: openFolders },
        });
        return;
      }
      const project = result.project;
      undoable({
        message: `Added ${project.name} to ${workspaceName}`,
        undo: async () => {
          await removeProject({ projectId: project.id });
        },
      });
    } catch (error) {
      void reportError({
        title: `Couldn't add the folder to ${workspaceName}`,
        error,
        workspaceId,
      });
    }
  }, [addProject, pickFolder, removeProject, reportError, showToast, workspaceId, workspaceName]);
};
