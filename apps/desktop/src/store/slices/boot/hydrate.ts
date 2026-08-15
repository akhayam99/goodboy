import type { SessionId, WorkspaceId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { getSetting, listWorkspaces } from '@goodboy/db';
import { invoke } from '@tauri-apps/api/core';
import { runDbMigrations, tauriDatabase } from '../../../shared/lib/db';
import { migrateLsToDb } from '../../../shared/lib/ls-to-db-migration';
import { hydrateOnboardingFromDb } from '../../../features/onboarding/onboarding-store';
import {
  buildProviderList,
  checkProviderAuth,
  getCodexStatus,
  getCursorStatus,
  getGeminiStatus,
  getMoonshotStatus,
  getOpenCodeStatus,
  getOpenRouterStatus,
  getProviderStatus,
  type ProviderAuthResults,
  type ProviderStatuses,
} from '../../../features/providers/providers';
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

export const resetHydrateMemo = (): void => {
  hydratePromise = null;
};

export const hydrate = (set: SetFn, get: GetFn) => {
  return async (): Promise<void> => {
    if (hydratePromise) {
      return hydratePromise;
    }
    hydratePromise = (async () => {
      const bootStartedAt = Date.now();
      let previousTransitionAt = bootStartedAt;
      try {
        recordBootBreadcrumb({ phase: 'pending', detail: 'start' });
        const migratingAt = Date.now();
        set({ bootPhase: 'migrating', error: null });
        recordBootBreadcrumb({
          phase: 'migrating',
          detail: `ms=${migratingAt - previousTransitionAt}`,
        });
        previousTransitionAt = migratingAt;
        await runDbMigrations();
        await migrateLsToDb();
        await hydrateOnboardingFromDb();
        await get().hydrateChangelogSeen();
        void get()
          .loadNotifications()
          .catch(() => {});

        const loadingSettingsAt = Date.now();
        set({ bootPhase: 'loading-settings' });
        recordBootBreadcrumb({
          phase: 'loading-settings',
          detail: `ms=${loadingSettingsAt - previousTransitionAt}`,
        });
        previousTransitionAt = loadingSettingsAt;
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

        const detectingCliAt = Date.now();
        set({ bootPhase: 'detecting-cli' });
        recordBootBreadcrumb({
          phase: 'detecting-cli',
          detail: `ms=${detectingCliAt - previousTransitionAt}`,
        });
        previousTransitionAt = detectingCliAt;
        const [
          providerStatus,
          cursorStatus,
          codexStatus,
          geminiStatus,
          opencodeStatus,
          openrouterStatus,
          moonshotStatus,
        ] = await Promise.all([
          getProviderStatus('anthropic'),
          getCursorStatus(),
          getCodexStatus(),
          getGeminiStatus(),
          getOpenCodeStatus(),
          getOpenRouterStatus(),
          getMoonshotStatus(),
        ]);
        const statuses: ProviderStatuses = {
          anthropic: providerStatus,
          cursor: cursorStatus,
          codex: codexStatus,
          gemini: geminiStatus,
          opencode: opencodeStatus,
          openrouter: openrouterStatus,
          moonshot: moonshotStatus,
        };
        set({
          providerStatus,
          cursorStatus,
          codexStatus,
          geminiStatus,
          providers: buildProviderList(statuses),
        });

        const [
          anthropicAuth,
          cursorAuth,
          codexAuth,
          geminiAuth,
          opencodeAuth,
          openrouterAuth,
          moonshotAuth,
        ] = await Promise.all([
          checkProviderAuth('anthropic'),
          checkProviderAuth('cursor'),
          checkProviderAuth('codex'),
          checkProviderAuth('gemini'),
          checkProviderAuth('opencode'),
          checkProviderAuth('openrouter'),
          checkProviderAuth('moonshot'),
        ]);
        const authResults: ProviderAuthResults = {
          anthropic: anthropicAuth,
          cursor: cursorAuth,
          codex: codexAuth,
          gemini: geminiAuth,
          opencode: opencodeAuth,
          openrouter: openrouterAuth,
          moonshot: moonshotAuth,
        };
        set({ authResults, providers: buildProviderList(statuses, authResults) });

        const loadingWorkspacesAt = Date.now();
        set({ bootPhase: 'loading-workspaces' });
        recordBootBreadcrumb({
          phase: 'loading-workspaces',
          detail: `ms=${loadingWorkspacesAt - previousTransitionAt}`,
        });
        previousTransitionAt = loadingWorkspacesAt;
        await get()
          .loadCredentials()
          .catch(() => {});
        const credentialProviderIds = new Set(
          get().providerCredentials.map((item) => item.providerId),
        );
        set({
          providers: buildProviderList(statuses, authResults, credentialProviderIds),
        });
        const workspaces = await listWorkspaces(tauriDatabase);
        set({ workspaces });
        await Promise.all(
          workspaces.map((w) =>
            get()
              .loadIntegrations(w.id)
              .catch(() => {}),
          ),
        );
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

        const restoringSessionAt = Date.now();
        set({ bootPhase: 'restoring-session' });
        recordBootBreadcrumb({
          phase: 'restoring-session',
          detail: `ms=${restoringSessionAt - previousTransitionAt}`,
        });
        previousTransitionAt = restoringSessionAt;
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
