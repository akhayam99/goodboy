import type { SessionId, WorkspaceId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { getSetting, listProjectsForWorkspace, listWorkspaces } from '@goodboy/db';
import { invoke } from '@tauri-apps/api/core';
import { runDbMigrations, tauriDatabase } from '../../../shared/lib/db';
import { migrateLsToDb } from '../../../shared/lib/ls-to-db-migration';
import { hydrateOnboardingFromDb } from '../../../features/onboarding/onboarding-store';
import { setWindowTitle, targetWorkspaceFromHash } from '../../../features/workspace/window';
import { consumeReloadIntent } from '../../../features/workspace/windowView';
import {
  SETTING_EDITOR_BINARY,
  SETTING_LAST_SESSION_ID,
  SETTING_LAST_WORKSPACE_ID,
  SETTING_REOPEN_LAST,
} from '../../../features/settings/settings';
import { recoverStagedFileVersions } from '../file-versions/recoverStagedFileVersions';
import { applyQaDecidingPreview } from '../workflows/applyQaDecidingPreview';
import { adoptLegacyIntegrationSecrets } from '../integrations/adoptLegacyIntegrationSecrets';
import { drainAuditRetryQueue } from './auditRetryQueue';
import type { GetFn, SetFn } from './types';
import type { BootPhase } from '../../types';

type RecordBootBreadcrumbParams = {
  phase: BootPhase;
  detail?: string;
};

const recordBootBreadcrumb = ({ phase, detail }: RecordBootBreadcrumbParams): void => {
  try {
    void Promise.resolve(invoke('boot_breadcrumb', { phase, detail })).catch(() => undefined);
  } catch {
    return;
  }
};

let hydratePromise: Promise<void> | null = null;

export const hydrate = (set: SetFn, get: GetFn) => {
  return async (): Promise<void> => {
    if (hydratePromise) {
      return hydratePromise;
    }
    hydratePromise = (async () => {
      const bootStartedAt = Date.now();
      try {
        recordBootBreadcrumb({ phase: 'pending', detail: 'start' });
        const migratingAt = Date.now();
        set({ bootPhase: 'migrating', error: null });
        await runDbMigrations();
        await migrateLsToDb();
        await hydrateOnboardingFromDb();
        await get().hydrateChangelogSeen();
        void get()
          .loadNotifications()
          .catch(() => {});
        recordBootBreadcrumb({
          phase: 'migrating',
          detail: `ms=${Date.now() - migratingAt}`,
        });

        const loadingSettingsAt = Date.now();
        set({ bootPhase: 'loading-settings' });
        const [editorBinary, lastWorkspaceRaw, lastSessionRaw, reopenLastRaw] = await Promise.all([
          getSetting(tauriDatabase, SETTING_EDITOR_BINARY),
          getSetting(tauriDatabase, SETTING_LAST_WORKSPACE_ID),
          getSetting(tauriDatabase, SETTING_LAST_SESSION_ID),
          getSetting(tauriDatabase, SETTING_REOPEN_LAST),
        ]);
        set((state) => {
          const next = { ...state.settings };
          if (editorBinary !== null) {
            next[SETTING_EDITOR_BINARY] = editorBinary;
          }
          if (lastWorkspaceRaw !== null) {
            next[SETTING_LAST_WORKSPACE_ID] = lastWorkspaceRaw;
          }
          if (lastSessionRaw !== null) {
            next[SETTING_LAST_SESSION_ID] = lastSessionRaw;
          }
          if (reopenLastRaw !== null) {
            next[SETTING_REOPEN_LAST] = reopenLastRaw;
          }
          return { settings: next };
        });
        recordBootBreadcrumb({
          phase: 'loading-settings',
          detail: `ms=${Date.now() - loadingSettingsAt}`,
        });

        const detectingCliAt = Date.now();
        set({ bootPhase: 'detecting-cli' });
        await get()
          .loadCredentials()
          .catch(() => {});
        recordBootBreadcrumb({
          phase: 'detecting-cli',
          detail: `ms=${Date.now() - detectingCliAt}`,
        });

        const loadingWorkspacesAt = Date.now();
        set({ bootPhase: 'loading-workspaces' });
        const workspaces = await listWorkspaces({ db: tauriDatabase });
        const projects = (
          await Promise.all(
            workspaces.map((workspace) =>
              listProjectsForWorkspace({ db: tauriDatabase, workspaceId: workspace.id }),
            ),
          )
        ).flat();
        set({ workspaces, projects });
        await adoptLegacyIntegrationSecrets();
        await get()
          .loadIntegrationCredentials()
          .catch(() => {});
        try {
          await recoverStagedFileVersions({
            onFailure: async ({ sessionId, runId, message }) => {
              await get().emitNotification(
                'error',
                'warning',
                'Some staged file versions could not be recovered',
                `session: ${sessionId}. run: ${runId}. details: ${message}`,
                { sessionId },
              );
            },
          });
        } catch (error) {
          await get().emitNotification(
            'error',
            'warning',
            'File version recovery could not run at startup',
            formatError(error),
          );
        }

        await applyQaDecidingPreview({ set }).catch(() => {});
        recordBootBreadcrumb({
          phase: 'loading-workspaces',
          detail: `ms=${Date.now() - loadingWorkspacesAt}`,
        });

        const restoringSessionAt = Date.now();
        set({ bootPhase: 'restoring-session' });
        const reloadIntent = consumeReloadIntent();
        if (reloadIntent?.mode === 'restore') {
          const snapWorkspace = workspaces.find((w) => w.id === reloadIntent.workspaceId) ?? null;
          if (snapWorkspace) {
            await get().setCurrentWorkspace(snapWorkspace.id);
            void setWindowTitle(snapWorkspace.name);
            const snapSessionId = reloadIntent.sessionId;
            if (snapSessionId && get().sessions.some((s) => s.id === snapSessionId)) {
              await get().setCurrentSession(snapSessionId);
              const snapAgentId = reloadIntent.agentId;
              if (
                snapAgentId &&
                (get().sessionPhaseRuns[snapSessionId] ?? []).some((r) => r.id === snapAgentId)
              ) {
                await get().selectAgent(snapSessionId, snapAgentId);
              }
            }
          }
        } else if (!reloadIntent) {
          const hashWorkspaceId = targetWorkspaceFromHash();
          const hashWorkspace = hashWorkspaceId
            ? (workspaces.find((w) => w.id === hashWorkspaceId) ?? null)
            : null;
          const reopenLast = reopenLastRaw === '1';
          if (hashWorkspace) {
            await get().setCurrentWorkspace(hashWorkspace.id);
            void setWindowTitle(hashWorkspace.name);
          } else if (reopenLast) {
            const lastWorkspaceId =
              lastWorkspaceRaw && lastWorkspaceRaw.length > 0
                ? (lastWorkspaceRaw as WorkspaceId)
                : null;
            const targetWorkspace = lastWorkspaceId
              ? (workspaces.find((w) => w.id === lastWorkspaceId) ?? null)
              : null;
            if (targetWorkspace) {
              await get().setCurrentWorkspace(targetWorkspace.id);
              const lastSessionId =
                lastSessionRaw && lastSessionRaw.length > 0 ? (lastSessionRaw as SessionId) : null;
              if (lastSessionId) {
                const sessions = get().sessions;
                if (sessions.some((s) => s.id === lastSessionId)) {
                  await get().setCurrentSession(lastSessionId);
                }
              }
            }
          }
        }

        recordBootBreadcrumb({
          phase: 'restoring-session',
          detail: `ms=${Date.now() - restoringSessionAt}`,
        });
        set({ bootPhase: 'ready', hydrated: true });
        recordBootBreadcrumb({
          phase: 'ready',
          detail: `ms=${Date.now() - bootStartedAt},ok`,
        });

        void drainAuditRetryQueue(set);

        void get()
          .reconcileOrphanWorktrees()
          .catch(() => {});

        void get().refreshGithubStatus();
      } catch (err) {
        recordBootBreadcrumb({ phase: 'error', detail: 'error' });
        set({
          bootPhase: 'error',
          error: formatError(err),
          hydrated: true,
        });
      }
    })();
    const ownPromise = hydratePromise;
    try {
      await ownPromise;
    } finally {
      if (hydratePromise === ownPromise) {
        hydratePromise = null;
      }
    }
  };
};

export const retryHydrate = (get: GetFn) => {
  return async (): Promise<void> => {
    const inFlight = hydratePromise;
    if (inFlight !== null) {
      await inFlight;
      return;
    }
    await get().hydrate();
  };
};
