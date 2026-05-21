import {
  deleteWorkspaceIntegration as deleteIntegrationInDb,
  listIntegrationsForWorkspace,
  upsertWorkspaceIntegration,
} from '@goodboy/db';
import type {
  IsoDateTime,
  LinearIntegrationConfig,
  WorkspaceId,
  WorkspaceIntegration,
  WorkspaceIntegrationId,
} from '@goodboy/types';
import {
  linearConnect,
  linearDisconnect,
  type LinearViewer,
} from '../../features/integrations/linear/client';
import { tauriDatabase } from '../../shared/lib/db';
import type { AppStore } from '../store';

type SetFn = (p: Partial<AppStore> | ((s: AppStore) => Partial<AppStore>)) => void;
type GetFn = () => AppStore;

function configFromViewer(viewer: LinearViewer): LinearIntegrationConfig {
  return {
    workspaceUrlKey: viewer.organization.urlKey,
    viewerUserId: viewer.id,
    viewerName: viewer.name,
  };
}

export function createIntegrationsSlice(set: SetFn, get: GetFn) {
  return {
    /** Hydrate integrations cache for a single workspace from the DB. */
    loadIntegrations: async (workspaceId: WorkspaceId) => {
      const rows = await listIntegrationsForWorkspace(tauriDatabase, workspaceId);
      set((state) => ({
        workspaceIntegrations: { ...state.workspaceIntegrations, [workspaceId]: rows },
      }));
    },

    /**
     * Connect Linear: verifies the PAT via Rust, persists token to the OS
     * keychain, and writes/updates the workspace_integrations row with the
     * viewer snapshot.
     */
    connectLinear: async (workspaceId: WorkspaceId, token: string): Promise<LinearViewer> => {
      const viewer = await linearConnect(workspaceId, token);
      const now = new Date().toISOString() as IsoDateTime;
      const existing = get().workspaceIntegrations[workspaceId]?.find(
        (i) => i.provider === 'linear',
      );
      const integration: WorkspaceIntegration = {
        id: (existing?.id ?? crypto.randomUUID()) as WorkspaceIntegrationId,
        workspaceId,
        provider: 'linear',
        config: { ...(existing?.config ?? {}), ...configFromViewer(viewer) },
        credentialKey: `goodboy.workspace.${workspaceId}.linear`,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      await upsertWorkspaceIntegration(tauriDatabase, integration);
      set((state) => {
        const current = state.workspaceIntegrations[workspaceId] ?? [];
        const rest = current.filter((i) => i.provider !== 'linear');
        return {
          workspaceIntegrations: {
            ...state.workspaceIntegrations,
            [workspaceId]: [...rest, integration],
          },
        };
      });
      return viewer;
    },

    /**
     * Update the optional team filter on the Linear integration. teamId=null
     * clears the filter so the user sees issues across all teams.
     */
    setLinearTeam: async (
      workspaceId: WorkspaceId,
      teamId: string | null,
      teamName: string | null,
    ) => {
      const existing = get().workspaceIntegrations[workspaceId]?.find(
        (i) => i.provider === 'linear',
      );
      if (!existing) throw new Error('linear integration not connected');
      const now = new Date().toISOString() as IsoDateTime;
      const nextConfig: LinearIntegrationConfig =
        teamId && teamName
          ? { ...existing.config, teamId, teamName }
          : (() => {
              const { teamId: _t, teamName: _tn, ...rest } = existing.config;
              return rest;
            })();
      const integration: WorkspaceIntegration = {
        ...existing,
        config: nextConfig,
        updatedAt: now,
      };
      await upsertWorkspaceIntegration(tauriDatabase, integration);
      set((state) => {
        const current = state.workspaceIntegrations[workspaceId] ?? [];
        const rest = current.filter((i) => i.provider !== 'linear');
        return {
          workspaceIntegrations: {
            ...state.workspaceIntegrations,
            [workspaceId]: [...rest, integration],
          },
        };
      });
    },

    disconnectLinear: async (workspaceId: WorkspaceId) => {
      await linearDisconnect(workspaceId);
      await deleteIntegrationInDb(tauriDatabase, workspaceId, 'linear');
      set((state) => {
        const current = state.workspaceIntegrations[workspaceId] ?? [];
        return {
          workspaceIntegrations: {
            ...state.workspaceIntegrations,
            [workspaceId]: current.filter((i) => i.provider !== 'linear'),
          },
        };
      });
    },
  };
}
