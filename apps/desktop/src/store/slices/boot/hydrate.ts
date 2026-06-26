import type { SessionId, WorkspaceId } from '@goodboy/types';
import { getSetting, listWorkspaces } from '@goodboy/db';
import { runDbMigrations, tauriDatabase } from '../../../shared/lib/db';
import { migrateLsToDb } from '../../../shared/lib/ls-to-db-migration';
import { hydrateOnboardingFromDb } from '../../../features/onboarding/onboarding-store';
import {
  buildProviderList,
  checkProviderAuth,
  getCodexStatus,
  getCursorStatus,
  getGeminiStatus,
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
import { formatError } from '../../../shared/lib/errors';
import { drainAuditRetryQueue } from './auditRetryQueue';
import type { GetFn, SetFn } from './types';

let hydratePromise: Promise<void> | null = null;

export const hydrate = (set: SetFn, get: GetFn) => {
  return async (): Promise<void> => {
    if (hydratePromise) {
      return hydratePromise;
    }
    hydratePromise = (async () => {
      try {
        set({ bootPhase: 'migrating', error: null });
        await runDbMigrations();
        await migrateLsToDb();
        await hydrateOnboardingFromDb();

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

        set({ bootPhase: 'detecting-cli' });
        const [providerStatus, cursorStatus, codexStatus, geminiStatus] = await Promise.all([
          getProviderStatus('anthropic'),
          getCursorStatus(),
          getCodexStatus(),
          getGeminiStatus(),
        ]);
        const statuses: ProviderStatuses = {
          anthropic: providerStatus,
          cursor: cursorStatus,
          codex: codexStatus,
          gemini: geminiStatus,
        };
        set({
          providerStatus,
          cursorStatus,
          codexStatus,
          geminiStatus,
          providers: buildProviderList(statuses),
        });

        const [anthropicAuth, cursorAuth, codexAuth, geminiAuth] = await Promise.all([
          checkProviderAuth('anthropic'),
          checkProviderAuth('cursor'),
          checkProviderAuth('codex'),
          checkProviderAuth('gemini'),
        ]);
        const authResults: ProviderAuthResults = {
          anthropic: anthropicAuth,
          cursor: cursorAuth,
          codex: codexAuth,
          gemini: geminiAuth,
        };
        set({ authResults, providers: buildProviderList(statuses, authResults) });

        set({ bootPhase: 'loading-workspaces' });
        await get()
          .loadCredentials()
          .catch(() => {});
        const workspaces = await listWorkspaces(tauriDatabase);
        set({ workspaces });
        await Promise.all(
          workspaces.map((w) =>
            get()
              .loadIntegrations(w.id)
              .catch(() => {}),
          ),
        );

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

        set({ bootPhase: 'ready', hydrated: true });

        void drainAuditRetryQueue(set);

        void get().refreshGithubStatus();
      } catch (err) {
        set({
          bootPhase: 'error',
          error: formatError(err),
          hydrated: true,
        });
      }
    })();
    try {
      await hydratePromise;
    } finally {
      hydratePromise = null;
    }
  };
};
