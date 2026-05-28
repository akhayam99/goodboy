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
import { detectEditors } from '../../../shared/lib/editor';
import {
  SETTING_EDITOR_BINARY,
  SETTING_LAST_SESSION_ID,
  SETTING_LAST_WORKSPACE_ID,
} from '../../../features/settings/settings';
import { formatError } from '../../../shared/lib/errors';
import { drainAuditRetryQueue } from './auditRetryQueue';
import type { GetFn, SetFn } from './types';

// Module-scoped guard: React StrictMode mounts the root twice in dev so
// `useEffect(() => void hydrate(), …)` fires twice in rapid succession.
// Without this guard both invocations race on `runDbMigrations()` → UNIQUE
// constraint failed on schema_version.version. Returning the same in-flight
// promise makes the second call wait for the first.
let hydratePromise: Promise<void> | null = null;

export function hydrate(set: SetFn, get: GetFn) {
  return async (): Promise<void> => {
    if (hydratePromise) return hydratePromise;
    hydratePromise = (async () => {
      try {
        set({ bootPhase: 'migrating', error: null });
        await runDbMigrations();
        await migrateLsToDb();
        await hydrateOnboardingFromDb();

        set({ bootPhase: 'loading-settings' });
        const [editorBinary, lastWorkspaceRaw, lastSessionRaw] = await Promise.all([
          getSetting(tauriDatabase, SETTING_EDITOR_BINARY),
          getSetting(tauriDatabase, SETTING_LAST_WORKSPACE_ID),
          getSetting(tauriDatabase, SETTING_LAST_SESSION_ID),
        ]);
        set((state) => {
          const next = { ...state.settings };
          if (editorBinary !== null) next[SETTING_EDITOR_BINARY] = editorBinary;
          if (lastWorkspaceRaw !== null) next[SETTING_LAST_WORKSPACE_ID] = lastWorkspaceRaw;
          if (lastSessionRaw !== null) next[SETTING_LAST_SESSION_ID] = lastSessionRaw;
          return { settings: next };
        });

        set({ bootPhase: 'detecting-cli' });
        const [providerStatus, cursorStatus, codexStatus, geminiStatus, detectedEditors] =
          await Promise.all([
            getProviderStatus('anthropic'),
            getCursorStatus(),
            getCodexStatus(),
            getGeminiStatus(),
            detectEditors(),
          ]);
        set({ detectedEditors });
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
        const workspaces = await listWorkspaces(tauriDatabase);
        set({ workspaces });
        // Hydrate integrations cache for every active workspace so the
        // "Linear connected" badge + new-session issue picker work without
        // a roundtrip on first interaction.
        await Promise.all(
          workspaces.map((w) =>
            get()
              .loadIntegrations(w.id)
              .catch(() => {}),
          ),
        );

        set({ bootPhase: 'restoring-session' });
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

        set({ bootPhase: 'ready', hydrated: true });

        // Drain audit retry queue after boot, non-blocking, best-effort.
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
      // Clear so manual retry from BootSplash can re-run hydrate.
      hydratePromise = null;
    }
  };
}
