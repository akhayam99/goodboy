import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { WorkspaceId } from '@goodboy/types';
import { useNow } from '../../../../shared/hooks/useNow';
import { useAppStore } from '../../../../store';
import {
  railSubtitles,
  type RailSubtitleState,
} from '../../components/SettingsStudio/railSubtitles';
import type { SettingsStatus } from '../../components/SettingsStudio/settingsDirectory';

type Params = {
  readonly workspaceId: WorkspaceId | null;
};

const STATUS_CLOCK_MS = 60_000;

export const useSettingsStatus = ({ workspaceId }: Params): SettingsStatus => {
  const nowMs = useNow(STATUS_CLOCK_MS);
  const state = useAppStore(
    useShallow((store): RailSubtitleState => ({
      updaterStatus: store.updaterStatus,
      storageFolders: store.storageFolders,
      terminalTabs: store.terminalTabs,
      settings: store.settings,
      storageStats: store.storageStats,
      openSecurityFindings: store.openSecurityFindings,
      projects: store.projects,
      projectGitStatus: store.projectGitStatus,
    })),
  );

  const subtitles = useMemo(
    () => railSubtitles({ state, workspaceId, nowMs }),
    [state, workspaceId, nowMs],
  );

  return useMemo(() => ({ subtitles }), [subtitles]);
};
