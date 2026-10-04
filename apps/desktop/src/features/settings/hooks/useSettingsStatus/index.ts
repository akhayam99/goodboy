import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { ProviderId, WorkspaceId } from '@goodboy/types';
import { useNow } from '../../../../shared/hooks/useNow';
import { useAppStore } from '../../../../store';
import { connectedInventory } from '../../../integrations/connectedInventory';
import { TOOL_ORDER, toolRailEntries } from '../../../integrations/toolRailEntries';
import { useToolConnections } from '../../../integrations/useToolConnections';
import { orderProviders } from '../../../providers/orderProviders';
import { providerRailStatus } from '../../../providers/providerRailStatus';
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
      settings: store.settings,
      storageStats: store.storageStats,
      openSecurityFindings: store.openSecurityFindings,
      providers: store.providers,
      cliRequirements: store.cliRequirements,
      providerLimits: store.providerLimits,
      projects: store.projects,
      projectGitStatus: store.projectGitStatus,
    })),
  );
  const { integrations, connected, githubIdentity } = useToolConnections({ workspaceId });
  const connectedKey = TOOL_ORDER.map((tool) => connected[tool]).join();

  const subtitles = useMemo(
    () => railSubtitles({ state, workspaceId, nowMs }),
    [state, workspaceId, nowMs],
  );
  const providers = useMemo(
    () =>
      orderProviders({ providers: state.providers }).map((provider) => ({
        id: provider.id as ProviderId,
        label: provider.label,
        status: providerRailStatus({ provider, state }),
      })),
    [state],
  );
  const tools = useMemo(
    () => toolRailEntries({ integrations, connected, githubIdentity }),
    [integrations, connectedKey, githubIdentity],
  );
  const toolsInventory = useMemo(() => connectedInventory({ connected }), [connectedKey]);

  return useMemo(
    () => ({ subtitles, providers, tools, toolsInventory }),
    [subtitles, providers, tools, toolsInventory],
  );
};
