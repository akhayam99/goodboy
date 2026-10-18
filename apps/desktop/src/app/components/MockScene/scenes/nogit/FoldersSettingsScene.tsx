import { useCallback } from 'react';
import { useAppStore } from '../../../../../store';
import { SettingsFrame } from '../audit/SettingsFrame';
import { FOLDERS_SETTINGS_NOTES } from './foldersSeed';

const MB = 1024 * 1024;

export const FoldersSettingsScene = () => {
  const seed = useCallback(() => {
    useAppStore.setState({
      projects: [FOLDERS_SETTINGS_NOTES],
      folderPurpose: { [FOLDERS_SETTINGS_NOTES.id]: 'documents' },
      folderGit: {},
      folderGitNotice: {},
      folderVersionsStatus: {},
      folderHistorySizes: {
        [FOLDERS_SETTINGS_NOTES.id]: {
          usedBytes: 18 * MB,
          capBytes: 1024 * MB,
          usedShare: 18 / 1024,
          versionCount: 12,
        },
      },
      loadFolderHistorySize: async () => undefined,
      probeFolderGit: async () => null,
      loadProjectGitStatus: async () => undefined,
      loadProjectRootScripts: async () => undefined,
      loadScriptPins: async () => undefined,
      checkGoodboyIgnore: async () => undefined,
      loadTerminalWorkspaceFolder: async () => undefined,
    });
  }, []);

  return <SettingsFrame focus={{ scope: 'workspace', section: 'projects' }} seed={seed} />;
};
