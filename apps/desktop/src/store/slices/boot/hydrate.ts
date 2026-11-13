import { CHECK_STATE } from '../notifications/errorRecovery';
import type { Project, SessionId, Workspace, WorkspaceId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { getSettings, listProjectsForWorkspace, listWorkspaces } from '@goodboy/db';
import { invokeCommand } from '../../../shared/lib/invokeCommand';
import { tauriDatabase } from '../../../shared/lib/db';
import { runDbHygiene, runDbMigrations } from '../../../shared/lib/dbBoot';
import { newerDatabaseFromError } from '../../../shared/lib/newerDatabase';
import { hydrateOnboardingFromDb } from '../../../features/onboarding/onboardingSettings';
import { setWindowTitle, targetWorkspaceFromHash } from '../../../features/workspace/window';
import { consumeReloadIntent } from '../../../features/workspace/windowView';
import { restoreLaunchLayout, type LaunchLayout } from './restoreLaunchLayout';
import { reopenSecondaryWindows } from './reopenSecondaryWindows';
import { openWorkspaceOrFail } from './openWorkspaceOrFail';
import { runEachOnIdle } from './runEachOnIdle';
import {
  SETTING_CHAT_IMAGES,
  SETTING_CONTEXT_LEARNINGS,
  SETTING_EDITOR_BINARY,
  SETTING_HIDDEN_MODELS,
  SETTING_LAST_SESSION_ID,
  SETTING_LAST_WORKSPACE_ID,
  SETTING_REOPEN_LAST,
} from '../../../features/settings/settings';
import { readBackendRunIds, reconcileGhostAgents } from '../sessions/reconcileSessionRuns';
import { recoverStagedFileVersions } from '../file-versions/recoverStagedFileVersions';
import { createFolderSnapshotPort } from '../file-versions/createFolderSnapshotPort';
import { startFolderVersions } from '../file-versions/startFolderVersions';
import { inPlaceSnapshot } from '../turn/inPlaceSnapshot';
import { applyQaDecidingPreview } from '../workflows/applyQaDecidingPreview';
import { adoptLegacyIntegrationSecrets } from '../integrations/adoptLegacyIntegrationSecrets';
import type { LaunchReads } from '../workspaces/launchReads';
import { drainAuditRetryQueue } from './auditRetryQueue';
import { scheduleStorageCheck } from '../storage/scheduleStorageCheck';
import { scheduleSearchBackfill } from '../search-index/scheduleSearchBackfill';
import { markBoot } from '../../../shared/lib/bootMarks';
import { countPerf } from '../../../shared/lib/countPerf';
import { PERF_COUNT_NAMES } from '../../../shared/lib/perfCountNames';
import type { GetFn, SetFn } from './types';
import type { BootPhase } from './state';

const INTEGRATION_KEY_ADOPTION_COALESCE_KEY = 'boot:integration-key-adoption';

const DATABASE_HYGIENE_COALESCE_KEY = 'boot:database-hygiene';

const BOOT_SETTING_KEYS = [
  SETTING_EDITOR_BINARY,
  SETTING_LAST_WORKSPACE_ID,
  SETTING_LAST_SESSION_ID,
  SETTING_REOPEN_LAST,
  SETTING_HIDDEN_MODELS,
  SETTING_CONTEXT_LEARNINGS,
  SETTING_CHAT_IMAGES,
] as const;

const LAUNCH_READ_PHASES = [
  'loading-settings',
  'detecting-cli',
  'loading-workspaces',
] as const satisfies ReadonlyArray<BootPhase>;

type LaunchReadPhase = (typeof LAUNCH_READ_PHASES)[number];

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

type StoreParams = {
  readonly set: SetFn;
  readonly get: GetFn;
};

type WorkspaceReads = {
  readonly workspaces: ReadonlyArray<Workspace>;
  readonly projects: ReadonlyArray<Project>;
};

type PhaseRunParams<T> = {
  readonly phase: LaunchReadPhase;
  readonly run: () => Promise<T>;
};

type FinishPhaseParams = {
  readonly phase: LaunchReadPhase;
};

type LaunchFailure = {
  phase: LaunchReadPhase | null;
};

const readBootSettings = async ({
  set,
  get,
}: StoreParams): Promise<ReadonlyMap<string, string>> => {
  const [stored] = await Promise.all([
    getSettings({ db: tauriDatabase, keys: BOOT_SETTING_KEYS }),
    hydrateOnboardingFromDb(),
    get().hydrateBootstrapPhases(),
    get().hydrateFolderPurposes(),
    get().hydrateChangelogSeen(),
    get().hydrateCliRequirements(),
  ]);
  set((state) => {
    const next = { ...state.settings };
    for (const [key, value] of stored) {
      next[key] = value;
    }
    return { settings: next };
  });
  return stored;
};

const readWorkspaces = async ({ set }: Pick<StoreParams, 'set'>): Promise<WorkspaceReads> => {
  const workspaces = await listWorkspaces({ db: tauriDatabase });
  const projects = (
    await Promise.all(
      workspaces.map((workspace) =>
        listProjectsForWorkspace({ db: tauriDatabase, workspaceId: workspace.id }),
      ),
    )
  ).flat();
  set({ workspaces, projects });
  return { workspaces, projects };
};

const loadIntegrationKeys = async ({ get }: Pick<StoreParams, 'get'>): Promise<void> => {
  const adoption = await adoptLegacyIntegrationSecrets();
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
};

const recoverFileVersions = async ({ set, get }: StoreParams): Promise<void> => {
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
  inPlaceSnapshot.install({ port: createFolderSnapshotPort({ set, get }) });
  void startFolderVersions({ set, get, nowMs: Date.now() });
};

const stopGhostRuns = async (): Promise<ReadonlySet<string>> => {
  const liveRunIds = await readBackendRunIds();
  await reconcileGhostAgents({ liveRunIds }).catch(() => 0);
  return new Set(liveRunIds ?? []);
};

const runAfterReadyOnIdle = ({ get }: Pick<StoreParams, 'get'>): void => {
  void runEachOnIdle({
    tasks: [
      () => void get().loadEndedWork(),
      () =>
        void get()
          .reconcileOrphanWorktrees()
          .catch(() => {}),
      () =>
        void get()
          .loadProviderLimits()
          .then(() => get().probeProviderLimits())
          .catch(() => {}),
      () => void drainAuditRetryQueue(get),
      () => void get().closeStaleBrowserTabs(),
      () =>
        void runDbHygiene().catch((error: unknown) =>
          get().reportError({
            recovery: CHECK_STATE,
            severity: 'warning',
            title: "Couldn't tidy the database after launch",
            error,
            coalesceKey: DATABASE_HYGIENE_COALESCE_KEY,
          }),
        ),
    ],
  });
};

let hydratePromise: Promise<void> | null = null;

export const hydrate = (set: SetFn, get: GetFn) => {
  return async (): Promise<void> => {
    if (hydratePromise) {
      return hydratePromise;
    }
    hydratePromise = (async () => {
      const bootStartedAt = Date.now();
      const failure: LaunchFailure = { phase: null };
      let launchReadsAt = bootStartedAt;
      const finishedPhases = new Set<LaunchReadPhase>();

      const failingIn = async <T>({ phase, run }: PhaseRunParams<T>): Promise<T> => {
        try {
          return await run();
        } catch (error) {
          failure.phase = failure.phase ?? phase;
          throw error;
        }
      };

      const finishPhase = ({ phase }: FinishPhaseParams): void => {
        finishedPhases.add(phase);
        recordBootBreadcrumb({ phase, detail: `ms=${Date.now() - launchReadsAt}` });
        if (failure.phase !== null) {
          return;
        }
        const next = LAUNCH_READ_PHASES.find((candidate) => !finishedPhases.has(candidate));
        if (next !== undefined) {
          set({ bootPhase: next });
        }
      };

      try {
        recordBootBreadcrumb({ phase: 'pending', detail: 'start' });
        countBootStep({ step: 'pending' });
        const migratingAt = Date.now();
        set({
          bootPhase: 'migrating',
          bootFailedPhase: null,
          newerDatabase: null,
          error: null,
          isShellReady: false,
        });
        await runDbMigrations();
        countBootStep({ step: 'migrations' });
        recordBootBreadcrumb({
          phase: 'migrating',
          detail: `ms=${Date.now() - migratingAt}`,
        });
        void get()
          .loadNotifications()
          .catch(() => {});

        launchReadsAt = Date.now();
        set({ bootPhase: 'loading-settings' });
        const [stored, { workspaces, projects }, liveRunIds] = await Promise.all([
          failingIn({
            phase: 'loading-settings',
            run: async () => {
              const settings = await readBootSettings({ set, get });
              finishPhase({ phase: 'loading-settings' });
              return settings;
            },
          }),
          failingIn({
            phase: 'loading-workspaces',
            run: async () => {
              const reads = await readWorkspaces({ set });
              finishPhase({ phase: 'loading-workspaces' });
              return reads;
            },
          }),
          failingIn({ phase: 'loading-workspaces', run: stopGhostRuns }),
          failingIn({
            phase: 'detecting-cli',
            run: async () => {
              await get()
                .loadCredentials()
                .catch(() => {});
              finishPhase({ phase: 'detecting-cli' });
            },
          }),
          failingIn({ phase: 'loading-workspaces', run: () => loadIntegrationKeys({ get }) }),
          failingIn({ phase: 'loading-workspaces', run: () => recoverFileVersions({ set, get }) }),
          failingIn({
            phase: 'loading-workspaces',
            run: () => applyQaDecidingPreview({ set }).catch(() => {}),
          }),
        ]);
        countBootStep({ step: 'launch-reads' });
        const launch: LaunchReads = { projects, liveRunIds };
        const lastWorkspaceRaw = stored.get(SETTING_LAST_WORKSPACE_ID) ?? null;
        const lastSessionRaw = stored.get(SETTING_LAST_SESSION_ID) ?? null;
        const reopenLastRaw = stored.get(SETTING_REOPEN_LAST) ?? null;

        const restoringSessionAt = Date.now();
        set({ bootPhase: 'restoring-session' });
        const reloadIntent = consumeReloadIntent();
        let launchLayout: LaunchLayout | null = null;
        if (reloadIntent?.mode === 'restore') {
          const snapWorkspace = workspaces.find((w) => w.id === reloadIntent.workspaceId) ?? null;
          const opened =
            snapWorkspace === null
              ? null
              : await openWorkspaceOrFail({ set, get, id: snapWorkspace.id, launch });
          if (snapWorkspace !== null && opened?.isLatest === true) {
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
            set,
            get,
            workspaces,
            isReopenLast: reopenLast,
            launch,
          }).catch(() => null);
          const isLayoutRestored = launchLayout?.isRestored === true;
          if (!isLayoutRestored && hashWorkspace) {
            await openWorkspaceOrFail({ set, get, id: hashWorkspace.id, launch });
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
              const { isLatest } = await openWorkspaceOrFail({
                set,
                get,
                id: targetWorkspace.id,
                launch,
              });
              const lastSessionId =
                lastSessionRaw && lastSessionRaw.length > 0 ? (lastSessionRaw as SessionId) : null;
              if (isLatest && lastSessionId) {
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
        countBootStep({ step: 'ready' });
        set({ bootPhase: 'ready', hydrated: true, isShellReady: true });
        markBoot({ name: 'hydrated' });
        void reopenSecondaryWindows({ layouts: launchLayout?.secondary ?? [] });
        recordBootBreadcrumb({
          phase: 'ready',
          detail: `ms=${Date.now() - bootStartedAt},ok`,
        });

        void get().refreshGithubStatus();
        scheduleStorageCheck({ get });
        scheduleSearchBackfill({ get });
        runAfterReadyOnIdle({ get });
      } catch (err) {
        recordBootBreadcrumb({ phase: 'error', detail: 'error' });
        set({
          bootPhase: 'error',
          bootFailedPhase: failure.phase ?? get().bootPhase,
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
