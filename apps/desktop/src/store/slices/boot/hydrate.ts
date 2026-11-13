import { CHECK_STATE } from '../notifications/errorRecovery';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { getSettings, listProjectsForWorkspace, listWorkspaces } from '@goodboy/db';
import { invokeCommand } from '../../../shared/lib/invokeCommand';
import { tauriDatabase } from '../../../shared/lib/db';
import { runDbMigrations } from '../../../shared/lib/dbBoot';
import { newerDatabaseFromError } from '../../../shared/lib/newerDatabase';
import { hydrateOnboardingFromDb } from '../../../features/onboarding/onboardingSettings';
import { setWindowTitle, targetWorkspaceFromHash } from '../../../features/workspace/window';
import { consumeReloadIntent } from '../../../features/workspace/windowView';
import { restoreLaunchLayout, type LaunchLayout } from './restoreLaunchLayout';
import { reopenSecondaryWindows } from './reopenSecondaryWindows';
import { openWorkspaceOrFail } from './openWorkspaceOrFail';
import {
  SETTING_CHAT_IMAGES,
  SETTING_CONTEXT_LEARNINGS,
  SETTING_EDITOR_BINARY,
  SETTING_HIDDEN_MODELS,
  SETTING_LAST_SESSION_ID,
  SETTING_LAST_WORKSPACE_ID,
  SETTING_REOPEN_LAST,
} from '../../../features/settings/settings';
import { reconcileGhostAgents } from '../sessions/reconcileSessionRuns';
import { recoverStagedFileVersions } from '../file-versions/recoverStagedFileVersions';
import { createFolderSnapshotPort } from '../file-versions/createFolderSnapshotPort';
import { startFolderVersions } from '../file-versions/startFolderVersions';
import { inPlaceSnapshot } from '../turn/inPlaceSnapshot';
import { applyQaDecidingPreview } from '../workflows/applyQaDecidingPreview';
import { adoptLegacyIntegrationSecrets } from '../integrations/adoptLegacyIntegrationSecrets';
import { drainAuditRetryQueue } from './auditRetryQueue';
import { scheduleStorageCheck } from '../storage/scheduleStorageCheck';
import { scheduleSearchBackfill } from '../search-index/scheduleSearchBackfill';
import { markBoot } from '../../../shared/lib/bootMarks';
import { countPerf } from '../../../shared/lib/countPerf';
import { PERF_COUNT_NAMES } from '../../../shared/lib/perfCountNames';
import type { GetFn, SetFn } from './types';
import type { BootPhase } from './state';

const INTEGRATION_KEY_ADOPTION_COALESCE_KEY = 'boot:integration-key-adoption';

type RecordBootBreadcrumbParams = {
  phase: BootPhase;
  detail?: string;
};

const recordBootBreadcrumb = ({ phase, detail }: RecordBootBreadcrumbParams): void => {
  if (phase !== 'error') {
    markBoot({ name: phase });
  }
  try {
    void Promise.resolve(invokeCommand('boot_breadcrumb', { phase, detail })).catch(
      () => undefined,
    );
  } catch {
    return;
  }
};

type CountBootStepParams = {
  step: string;
};

const countBootStep = ({ step }: CountBootStepParams): void =>
  countPerf({ name: PERF_COUNT_NAMES.bootStep, detail: step });

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
        countBootStep({ step: 'pending' });
        const migratingAt = Date.now();
        set({ bootPhase: 'migrating', bootFailedPhase: null, newerDatabase: null, error: null });
        await runDbMigrations();
        countBootStep({ step: 'migrations' });
        await hydrateOnboardingFromDb();
        countBootStep({ step: 'onboarding' });
        await Promise.all([
          get().hydrateBootstrapPhases(),
          get().hydrateFolderPurposes(),
          get().hydrateChangelogSeen(),
          get().hydrateCliRequirements(),
        ]);
        countBootStep({ step: 'independent-hydrations' });
        void get()
          .loadNotifications()
          .catch(() => {});
        void get()
          .loadProviderLimits()
          .then(() => get().probeProviderLimits())
          .catch(() => {});
        countBootStep({ step: 'notifications-and-limits' });
        recordBootBreadcrumb({
          phase: 'migrating',
          detail: `ms=${Date.now() - migratingAt}`,
        });

        const loadingSettingsAt = Date.now();
        set({ bootPhase: 'loading-settings' });
        const bootKeys = [
          SETTING_EDITOR_BINARY,
          SETTING_LAST_WORKSPACE_ID,
          SETTING_LAST_SESSION_ID,
          SETTING_REOPEN_LAST,
          SETTING_HIDDEN_MODELS,
          SETTING_CONTEXT_LEARNINGS,
          SETTING_CHAT_IMAGES,
        ] as const;
        const stored = await getSettings({ db: tauriDatabase, keys: bootKeys });
        const lastWorkspaceRaw = stored.get(SETTING_LAST_WORKSPACE_ID) ?? null;
        const lastSessionRaw = stored.get(SETTING_LAST_SESSION_ID) ?? null;
        const reopenLastRaw = stored.get(SETTING_REOPEN_LAST) ?? null;
        set((state) => {
          const next = { ...state.settings };
          for (const [key, value] of stored) {
            next[key] = value;
          }
          return { settings: next };
        });
        countBootStep({ step: 'settings' });
        recordBootBreadcrumb({
          phase: 'loading-settings',
          detail: `ms=${Date.now() - loadingSettingsAt}`,
        });

        const detectingCliAt = Date.now();
        set({ bootPhase: 'detecting-cli' });
        await get()
          .loadCredentials()
          .catch(() => {});
        countBootStep({ step: 'credentials' });
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
        countBootStep({ step: 'workspaces' });
        const adoption = await adoptLegacyIntegrationSecrets();
        countBootStep({ step: 'integration-key-adoption' });
        if (adoption.ok === false) {
          void get().reportError({
            recovery: CHECK_STATE,
            severity: 'warning',
            title: "Couldn't move saved integration keys to the keychain",
            error: adoption.error,
            coalesceKey: INTEGRATION_KEY_ADOPTION_COALESCE_KEY,
          });
        }
        await get()
          .loadIntegrationCredentials()
          .catch(() => {});
        countBootStep({ step: 'integration-credentials' });
        try {
          await recoverStagedFileVersions({
            onFailure: async ({ sessionId, runId, message }) => {
              await get().emitNotification({
                kind: 'error',
                severity: 'warning',
                title: 'Some staged file versions could not be recovered',
                body: `session: ${sessionId}. run: ${runId}. details: ${message}`,
                sessionId,
              });
            },
          });
        } catch (error) {
          await get().emitNotification({
            kind: 'error',
            severity: 'warning',
            title: 'File version recovery could not run at startup',
            body: formatError(error),
          });
        }
        countBootStep({ step: 'staged-file-versions' });
        inPlaceSnapshot.install({ port: createFolderSnapshotPort({ set, get }) });
        void startFolderVersions({ set, get, nowMs: Date.now() });
        countBootStep({ step: 'folder-versions' });

        await reconcileGhostAgents().catch(() => 0);
        countBootStep({ step: 'ghost-agents' });
        await applyQaDecidingPreview({ set }).catch(() => {});
        countBootStep({ step: 'qa-preview' });
        recordBootBreadcrumb({
          phase: 'loading-workspaces',
          detail: `ms=${Date.now() - loadingWorkspacesAt}`,
        });

        const restoringSessionAt = Date.now();
        set({ bootPhase: 'restoring-session' });
        const reloadIntent = consumeReloadIntent();
        let launchLayout: LaunchLayout | null = null;
        if (reloadIntent?.mode === 'restore') {
          const snapWorkspace = workspaces.find((w) => w.id === reloadIntent.workspaceId) ?? null;
          if (snapWorkspace) {
            await openWorkspaceOrFail({ get, id: snapWorkspace.id });
            void setWindowTitle(snapWorkspace.name);
            const { location } = reloadIntent;
            if (location !== undefined) {
              await get().restoreLocation({ location });
            }
            const snapSessionId =
              reloadIntent.location === undefined ? reloadIntent.sessionId : null;
            if (snapSessionId && get().sessions.some((s) => s.id === snapSessionId)) {
              await get().setCurrentSession(snapSessionId);
              countBootStep({ step: 'open-session' });
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
          launchLayout = await restoreLaunchLayout({
            get,
            workspaces,
            isReopenLast: reopenLast,
          }).catch(() => null);
          const isLayoutRestored = launchLayout?.isRestored === true;
          if (!isLayoutRestored && hashWorkspace) {
            await openWorkspaceOrFail({ get, id: hashWorkspace.id });
            void setWindowTitle(hashWorkspace.name);
          } else if (!isLayoutRestored && reopenLast) {
            const lastWorkspaceId =
              lastWorkspaceRaw && lastWorkspaceRaw.length > 0
                ? (lastWorkspaceRaw as WorkspaceId)
                : null;
            const targetWorkspace = lastWorkspaceId
              ? (workspaces.find((w) => w.id === lastWorkspaceId) ?? null)
              : null;
            if (targetWorkspace) {
              await openWorkspaceOrFail({ get, id: targetWorkspace.id });
              const lastSessionId =
                lastSessionRaw && lastSessionRaw.length > 0 ? (lastSessionRaw as SessionId) : null;
              if (lastSessionId) {
                const sessions = get().sessions;
                if (sessions.some((s) => s.id === lastSessionId)) {
                  await get().setCurrentSession(lastSessionId);
                  countBootStep({ step: 'open-session' });
                }
              }
            }
          }
        }

        countBootStep({ step: 'restoring-session' });
        recordBootBreadcrumb({
          phase: 'restoring-session',
          detail: `ms=${Date.now() - restoringSessionAt}`,
        });
        void get()
          .reattachScriptRuns()
          .catch(() => {});
        void get()
          .reattachTerminalTabs()
          .catch(() => {});
        void get().loadEndedWork();
        countBootStep({ step: 'ready' });
        set({ bootPhase: 'ready', hydrated: true });
        markBoot({ name: 'hydrated' });
        void reopenSecondaryWindows({ layouts: launchLayout?.secondary ?? [] });
        recordBootBreadcrumb({
          phase: 'ready',
          detail: `ms=${Date.now() - bootStartedAt},ok`,
        });

        void drainAuditRetryQueue(get);

        void get()
          .reconcileOrphanWorktrees()
          .catch(() => {});
        void get().closeStaleBrowserTabs();
        scheduleStorageCheck({ get });
        scheduleSearchBackfill({ get });

        void get().refreshGithubStatus();
      } catch (err) {
        recordBootBreadcrumb({ phase: 'error', detail: 'error' });
        set({
          bootPhase: 'error',
          bootFailedPhase: get().bootPhase,
          newerDatabase: newerDatabaseFromError({ error: err }),
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
