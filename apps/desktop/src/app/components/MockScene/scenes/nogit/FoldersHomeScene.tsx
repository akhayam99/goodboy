import { useEffect, useState } from 'react';
import { WorkspaceLauncher } from '../../../../../features/workspace/components/WorkspaceLauncher';
import { hydrateOnboardingFromDb } from '../../../../../features/onboarding/onboardingSettings';
import { SETTING_REOPEN_LAST } from '../../../../../features/settings/settings';
import { useAppStore } from '../../../../../store';
import { mockSceneIpc } from '../mockSceneIpc';
import {
  FOLDERS_HOME,
  FOLDERS_HOME_NOTES,
  FOLDERS_HOME_WEB,
  FOLDERS_HOME_WORKSPACES,
} from './foldersSeed';

const HOME = '/mock';

const answer = (command: string): unknown =>
  command === 'plugin:path|resolve_directory' ? HOME : null;

const noop = () => undefined;

export const FoldersHomeScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    mockSceneIpc(answer);
    useAppStore.setState({
      hydrated: true,
      workspaces: FOLDERS_HOME_WORKSPACES,
      currentWorkspaceId: null,
      currentSessionId: null,
      projects: FOLDERS_HOME,
      folderPurpose: { [FOLDERS_HOME_WEB.id]: 'code', [FOLDERS_HOME_NOTES.id]: 'documents' },
      hydrateFolderPurposes: async () => undefined,
      settings: { [SETTING_REOPEN_LAST]: '1' },
    });
    void hydrateOnboardingFromDb();
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }
  return (
    <div className="h-screen w-screen overflow-hidden bg-background text-foreground">
      <WorkspaceLauncher isCreating={false} onCloseCreate={noop} />
    </div>
  );
};
