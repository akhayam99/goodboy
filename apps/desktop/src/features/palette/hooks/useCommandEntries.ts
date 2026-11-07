import { pullPaletteRepos } from '../pullPaletteRepos';
import { CHECK_STATE } from '../../../store/slices/notifications/errorRecovery';
import { destinationEntryOf } from '../destinationEntryOf';
import { contextPaletteEntryOf } from '../contextPaletteEntryOf';
import { useMemo } from 'react';
import { CircleArrowUp, PanelLeft, Plus, RotateCcw, Smartphone } from 'lucide-react';
import { useCurrentInnerColumn } from '@goodboy/ui';
import type { AgentId, ProjectScript, SessionId, Workflow } from '@goodboy/types';
import {
  BOARD_PLACE,
  EMPTY_ARRAY,
  agentPlace,
  sessionPlace,
  useAppStore,
  useCurrentSession,
  useCurrentWorkspace,
  useSessionPlans,
  useSessions,
  useWorkspaces,
} from '../../../store';
import { selectChatDoor } from '../../../store/slices/chat-last-open/selectChatDoor';
import { useUnreadSessionIds } from '../../../shared/hooks/useUnreadSessionIds';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { NAMES, formerNamesOf } from '../../../shared/utils/names';
import { switchTheme, type ThemePreference } from '../../../shared/lib/theme';
import { classifyAgent } from '../../session/agent-kind';
import { useLensDestinations } from '../../session/hooks/useLensDestinations';
import { requestNewSession } from '../../session/requestNewSession';
import { openNewSessionAs } from '../../session/startKind/openNewSessionAs';
import { openReportSheet } from '../../bug-report/openReportSheet';
import { dispatchWindowEvent } from '../../../shared/lib/dispatchWindowEvent';
import { openSettings } from '../../settings/openSettings';
import { terminalStudioPlace } from '../../terminal/terminalStudioPlace';
import { openSessionTerminalHere } from '../../terminal/openSessionTerminalHere';
import { openWorkspaceTerminal } from '../../terminal/openWorkspaceTerminal';
import { openImpactStudio } from '../../impact/openImpactStudio';
import { openRunDefaults } from '../../settings/openRunDefaults';
import { openChangelogStudio } from '../../changelog/changelogStudioEvent';
import { openNewWorkspace } from '../../workspace/openNewWorkspace';
import { useIsMainWindow } from '../../workspace/useIsMainWindow';
import { getWizardState, resumeSetup } from '../../onboarding/onboardingSettings';
import { useSettingsDirectory } from '../../settings/hooks/useSettingsDirectory';
import { settingsPaletteEntries } from '../../settings/settingsPaletteEntries';
import { guidePaletteEntries } from '../../settings/guidePaletteEntries';
import { checkForUpdatesNow } from '../../updater/checkForUpdatesNow';
import type { SettingsFocus } from '../../settings/settingsFocus';
import { useToast } from '../../../shared/components/Toast';
import { agentEntries } from '../sources/agentEntries';
import { startRunFromPresetEntries } from '../sources/startRunFromPresetEntries';
import { openStartRun } from '../../session/startRun/openStartRun';
import { openPlanAnywhere } from '../../plans/openPlanAnywhere';
import { requestAskReset } from '../../session/ask/requestAskReset';
import { isAskStreaming } from '../../../store/slices/ask/isAskStreaming';
import { selectOpenDrawer } from '../../../store/slices/drawer/selectOpenDrawer';
import { artifactEntries } from '../sources/artifactEntries';
import { sessionEntries } from '../sources/sessionEntries';
import { markAllReadEntries } from '../sources/markAllReadEntries';
import { workspaceEntries } from '../sources/workspaceEntries';
import { scriptPinEntries, type PinnedScriptTarget } from '../sources/scriptPinEntries';
import { useScriptPins } from '../../scripts';
import { runPinnedScript } from '../../scripts/runPinnedScript';
import { repoEntries } from '../sources/repoEntries';
import { openSessionAnywhere } from '../openSessionAnywhere';
import type { PaletteEntry } from '../types';
import { useSessionsEverywhere } from './useSessionsEverywhere';
import { projectById } from '../../../store/slices/projects/projectIndex';

const NEW_SESSION_WITH = {
  workflow: 'New workflow session',
  agent: 'New agent session',
} as const;

const THEME_CHOICES = ['dark', 'light', 'system'] as const satisfies ReadonlyArray<ThemePreference>;

const PAIR_SEPARATOR = '\u0000';

const LIST_SEPARATOR = '\u0001';

const openNotificationsDoor = (): void =>
  dispatchWindowEvent({ name: 'goodboy:open-notifications-studio', detail: { door: true } });

const openSettingsDoor = (focus: SettingsFocus): void => openSettings({ ...focus, door: true });

export const useCommandEntries = (): ReadonlyArray<PaletteEntry> => {
  const workspaces = useWorkspaces();
  const projects = useAppStore((s) => s.projects);
  const sessions = useSessions();
  const everywhere = useSessionsEverywhere();
  const currentWorkspace = useCurrentWorkspace();
  const currentSession = useCurrentSession();
  const settingsGroups = useSettingsDirectory({
    workspaceId: currentWorkspace?.id ?? null,
    workspaceName: currentWorkspace?.name ?? null,
  });
  const sessionId = currentSession === null ? null : (currentSession.id as SessionId);
  const openWorkspace = useAppStore((s) => s.openWorkspace);
  const navigate = useAppStore((s) => s.navigate);
  const openStudio = useAppStore((s) => s.openStudio);
  const switchStudio = useAppStore((s) => s.switchStudio);
  const toggleContextDrawer = useAppStore((s) => s.toggleContextDrawer);
  const projectPairs = useAppStore((s) =>
    Object.entries(s.sessionProjectMounts)
      .flatMap(([id, list]) => {
        const name = list[0]?.mountName;
        return name === undefined ? [] : [`${id}${PAIR_SEPARATOR}${name}`];
      })
      .join(LIST_SEPARATOR),
  );
  const scripts = useAppStore((s) =>
    currentWorkspace ? (s.projectScripts[currentWorkspace.id] ?? EMPTY_ARRAY) : EMPTY_ARRAY,
  ) as ReadonlyArray<ProjectScript>;
  const workflows: ReadonlyArray<Workflow> = useAppStore((s) =>
    currentWorkspace ? (s.phaseTemplates[currentWorkspace.id] ?? EMPTY_ARRAY) : EMPTY_ARRAY,
  );
  const agents = useAppStore((s) =>
    sessionId === null ? EMPTY_ARRAY : (s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY),
  );
  const artifacts = useAppStore((s) =>
    sessionId === null ? EMPTY_ARRAY : (s.sessionArtifacts[sessionId] ?? EMPTY_ARRAY),
  );
  const plans = useSessionPlans(sessionId);
  const agentKindOverride = useAppStore((s) => s.agentKindOverride);
  const isAskOpen = useAppStore((s) => {
    const drawer = selectOpenDrawer(s);
    return drawer !== null && drawer.kind === 'ask' && drawer.sessionId === sessionId;
  });
  const isAskReplying = useAppStore((s) =>
    sessionId === null ? false : isAskStreaming({ state: s, sessionId }),
  );
  const isInSession = useAppStore((s) => sessionId !== null && s.appStudio === null);
  const destinations = useLensDestinations({ sessionId });
  const runScript = useAppStore((s) => s.runScript);
  const workspaceProjects = useMemo(
    () =>
      currentWorkspace === null
        ? []
        : projects.filter((project) => project.workspaceId === currentWorkspace.id),
    [projects, currentWorkspace],
  );
  const projectGitStatus = useAppStore((s) => s.projectGitStatus);
  const scriptPins = useScriptPins({ projectIds: workspaceProjects.map((project) => project.id) });
  const reportError = useAppStore((s) => s.reportError);
  const markSessionsRead = useAppStore((s) => s.markSessionsRead);
  const unreadSessionIds = useUnreadSessionIds({ sessions });
  const { showToast } = useToast();
  const innerColumn = useCurrentInnerColumn();
  const isInMainWindow = useIsMainWindow();
  const canResumeSetup = isInMainWindow && getWizardState() !== 'done';

  return useMemo<ReadonlyArray<PaletteEntry>>(() => {
    const now = Date.now();
    const hasWorkspace = currentWorkspace !== null;
    const projectNames = new Map(
      projectPairs
        .split(LIST_SEPARATOR)
        .filter((pair) => pair !== '')
        .map((pair) => {
          const [id = '', name = ''] = pair.split(PAIR_SEPARATOR);
          return [id, name] as const;
        }),
    );
    const out: Array<PaletteEntry> = [
      ...sessionEntries({
        sessions,
        otherSessions: everywhere,
        workspaces,
        currentWorkspaceId: currentWorkspace?.id ?? null,
        projectNames,
        now,
        open: openSessionAnywhere,
      }),
    ];

    if (isAskOpen && !isAskReplying && sessionId !== null) {
      out.push({
        key: 'action:ask-reset',
        label: NAMES.newQuestion,
        secondary: [...formerNamesOf(NAMES.newQuestion), 'Reset Ask', 'New Ask chat'],
        kind: 'action',
        group: 'action',
        icon: RotateCcw,
        shortcut: 'ask.reset',
        run: () => {
          requestAskReset({ sessionId });
        },
      });
    }

    if (sessionId === null) {
      out.push({
        key: 'action:start-run-auto-picks',
        label: NAMES.startARun,
        kind: 'create',
        group: 'action',
        icon: CONCEPT_ICONS.autoRouting,
        run: () => openNewSessionAs({ startKind: 'auto' }),
      });
    }

    out.push(...markAllReadEntries({ sessionIds: unreadSessionIds, markRead: markSessionsRead }));

    if (sessionId !== null) {
      out.push(
        ...agentEntries({
          sessionId,
          agents,
          kindOf: ({ agent }) =>
            classifyAgent({ agent, override: agentKindOverride[agent.id as AgentId] ?? null }),
          open: ({ agentId }) => navigate({ to: agentPlace({ sessionId, agentId }) }),
        }),
        ...startRunFromPresetEntries({ sessionId, workflows, open: openStartRun }),
        ...artifactEntries({
          sessionId,
          plans,
          artifacts,
          open: ({ artifactId }) =>
            navigate({
              to: sessionPlace({
                sessionId,
                lens: 'plans',
                target: { kind: 'artifact', artifactId },
              }),
            }),
          openPlan: ({ artifactId }) => openPlanAnywhere({ sessionId, planId: artifactId }),
        }),
      );
      for (const destination of destinations) {
        out.push(destinationEntryOf({ sessionId, destination }));
      }
      out.push(contextPaletteEntryOf({ sessionId, toggle: toggleContextDrawer }));
    }

    out.push(...workspaceEntries({ workspaces, projects, open: openWorkspace }));

    if (hasWorkspace) {
      const workspaceId = currentWorkspace.id;
      out.push(
        {
          key: 'goto:board',
          label: 'Sessions',
          secondary: ['Board', 'Back to board'],
          kind: 'goto',
          group: null,
          icon: CONCEPT_ICONS.workspace,
          shortcut: 'session.board',
          run: () => navigate({ to: BOARD_PLACE }),
        },
        {
          key: 'goto:inbox',
          label: NAMES.tasks,
          secondary: formerNamesOf(NAMES.tasks),
          kind: 'goto',
          group: null,
          icon: CONCEPT_ICONS.inbox,
          run: () => dispatchWindowEvent({ name: 'goodboy:open-inbox', detail: { door: true } }),
        },
        {
          key: 'goto:chat',
          label: 'Chat',
          kind: 'goto',
          group: null,
          icon: CONCEPT_ICONS.chat,
          run: () =>
            openStudio({
              studio: { kind: 'chat', chatId: selectChatDoor({ state: useAppStore.getState() }) },
            }),
        },
        {
          key: 'goto:workflows',
          label: 'Workflows',
          kind: 'goto',
          group: null,
          icon: CONCEPT_ICONS.workflows,
          run: () =>
            dispatchWindowEvent({ name: 'goodboy:open-workflow-studio', detail: { door: true } }),
        },
        {
          key: 'goto:terminal',
          label: 'Terminal',
          secondary: ['Go to Terminal', 'Terminals'],
          kind: 'goto',
          group: null,
          icon: CONCEPT_ICONS.terminal,
          shortcut: 'terminal.studio',
          run: () =>
            switchStudio({
              studio: terminalStudioPlace({ sessionId: useAppStore.getState().currentSessionId }),
            }),
        },
        {
          key: 'goto:run-defaults',
          label: NAMES.runDefaults,
          kind: 'page',
          group: null,
          icon: CONCEPT_ICONS.workflows,
          secondary: formerNamesOf(NAMES.runDefaults),
          run: openRunDefaults,
        },
        {
          key: 'goto:impact',
          label: 'Impact',
          kind: 'goto',
          group: null,
          icon: CONCEPT_ICONS.impact,
          run: () => openImpactStudio({ door: true }),
        },
        {
          key: 'goto:impact-spend',
          label: 'Impact: Spend',
          kind: 'page',
          group: null,
          icon: CONCEPT_ICONS.budget,
          run: () => openImpactStudio({ scope: { kind: 'spend' }, door: true }),
        },
        {
          key: 'goto:monitoring',
          label: 'Monitoring',
          secondary: ['Go to Monitoring', 'Ports'],
          kind: 'goto',
          group: null,
          icon: CONCEPT_ICONS.monitoring,
          run: () => openStudio({ studio: { kind: 'monitoring' } }),
        },
        {
          key: 'goto:notifications',
          label: 'Notifications',
          kind: 'goto',
          group: null,
          icon: CONCEPT_ICONS.notifications,
          run: openNotificationsDoor,
        },
        {
          key: 'action:new-session',
          label: 'New session',
          kind: 'create',
          group: 'action',
          icon: Plus,
          shortcut: 'session.new',
          run: requestNewSession,
        },
        {
          key: 'action:new-session-workflow',
          label: NEW_SESSION_WITH.workflow,
          kind: 'create',
          group: 'action',
          icon: CONCEPT_ICONS.workflows,
          secondary: ['New workflow', NAMES.runKind.orchestrated, NAMES.runKind.preset],
          run: () => openNewSessionAs({ startKind: 'workflow', startShape: 'orchestrated' }),
        },
        {
          key: 'action:new-session-agent',
          label: NEW_SESSION_WITH.agent,
          kind: 'create',
          group: 'action',
          icon: CONCEPT_ICONS.agents,
          secondary: ['New agent', NAMES.runKind.autoAgent],
          run: () => openNewSessionAs({ startKind: 'agent', startShape: 'autoAgent' }),
        },
        {
          key: 'action:new-chat',
          label: 'New chat',
          kind: 'create',
          group: 'action',
          icon: Plus,
          shortcut: 'chat.new',
          run: () => openStudio({ studio: { kind: 'chat', chatId: null } }),
        },
        {
          key: 'action:new-terminal',
          label: isInSession ? 'New terminal in this session' : 'New terminal',
          kind: 'create',
          group: 'action',
          icon: Plus,
          secondary: ['Open terminal', 'New terminal'],
          run: () =>
            isInSession && sessionId !== null
              ? void openSessionTerminalHere({ sessionId, isFresh: true })
              : void openWorkspaceTerminal({ workspaceId }),
        },
      );
    }
    out.push({
      key: 'action:new-workspace',
      label: NAMES.newWorkspace,
      secondary: formerNamesOf(NAMES.newWorkspace),
      kind: 'create',
      group: 'action',
      icon: Plus,
      run: openNewWorkspace,
    });
    if (canResumeSetup) {
      out.push({
        key: 'action:resume-setup',
        label: NAMES.resumeSetup,
        kind: 'action',
        group: 'action',
        icon: RotateCcw,
        run: () => resumeSetup({ hasWorkspace: workspaces.length > 0 }),
      });
    }

    const runPinned = (target: PinnedScriptTarget) => {
      const missing = `Open a session with ${target.projectName} to run ${target.name}.`;
      if (sessionId === null || currentWorkspace === null) {
        showToast({ kind: 'warning', message: missing });
        return;
      }
      const failureTitle = `Couldn't run ${target.name}`;
      void runPinnedScript({
        sessionId,
        workspaceId: currentWorkspace.id,
        projectId: target.projectId,
        pinId: target.pinId,
      })
        .then((outcome) => {
          if (outcome.kind === 'not-here') {
            showToast({ kind: 'warning', message: missing });
            return;
          }
          if (outcome.result.exitCode !== 0) {
            void reportError({
              title: failureTitle,
              error: `Exited with code ${outcome.result.exitCode}.`,
              sessionId,
              recovery: { action: { kind: 'open-lens', sessionId, lens: 'scripts' } },
            });
            return;
          }
          showToast({ kind: 'success', message: `${target.name} finished.` });
        })
        .catch((error: unknown) =>
          reportError({ recovery: CHECK_STATE, title: failureTitle, error, sessionId }),
        );
    };
    out.push(
      ...scriptPinEntries({
        projects: workspaceProjects,
        pins: scriptPins,
        saved: scripts,
        run: runPinned,
      }),
    );

    out.push(
      ...repoEntries({
        projects: workspaceProjects,
        statuses: projectGitStatus,
        pull: (projects) => pullPaletteRepos({ projects, showToast }),
      }),
    );

    for (const script of scripts) {
      out.push({
        key: `script:${script.id}`,
        label: script.name,
        kind: 'script',
        group: 'script',
        icon: CONCEPT_ICONS.scripts,
        detail: projectById(projects, script.projectId)?.name ?? 'Folder script',
        tag: 'Script',
        run: () => {
          if (sessionId === null) {
            showToast({ kind: 'warning', message: `Open a session to run ${script.name}.` });
            return;
          }
          const failureTitle = `Couldn't run ${script.name}`;
          void runScript({ sessionId, scriptId: script.id })
            .then((result) => {
              if (result.exitCode !== 0) {
                void reportError({
                  title: failureTitle,
                  error: `Exited with code ${result.exitCode}.`,
                  sessionId,
                  recovery: { action: { kind: 'open-lens', sessionId, lens: 'scripts' } },
                });
                return;
              }
              showToast({ kind: 'success', message: `${script.name} finished.` });
            })
            .catch((error: unknown) =>
              reportError({ recovery: CHECK_STATE, title: failureTitle, error, sessionId }),
            );
        },
      });
    }

    if (innerColumn !== null) {
      out.push({
        key: 'action:inner-column',
        label: innerColumn.label,
        secondary: ['fold unfold inner column rail list'],
        kind: 'action',
        group: 'action',
        icon: PanelLeft,
        shortcut: 'innerColumn.toggle',
        run: innerColumn.toggle,
      });
    }

    out.push(
      {
        key: 'action:settings',
        label: 'Settings',
        secondary: ['Open settings'],
        kind: 'goto',
        group: 'action',
        icon: CONCEPT_ICONS.settings,
        shortcut: 'settings.open',
        run: () => openSettingsDoor({ scope: 'home' }),
      },
      ...settingsPaletteEntries({ groups: settingsGroups, open: openSettingsDoor }).filter(
        (entry) => entry.key !== 'setting:app:shortcuts',
      ),
      ...THEME_CHOICES.map((choice): PaletteEntry => ({
        key: `action:theme-${choice}`,
        label: `${NAMES.theme}: ${choice}`,
        kind: 'action',
        group: 'action',
        icon: CONCEPT_ICONS.appearance,
        secondary: ['appearance', 'color scheme', ...formerNamesOf(NAMES.theme)],
        run: () => switchTheme({ to: choice }),
      })),
      {
        key: 'action:check-updates',
        label: 'Check for updates',
        kind: 'action',
        group: 'action',
        icon: CircleArrowUp,
        secondary: ['update upgrade version'],
        run: checkForUpdatesNow,
      },
      {
        key: 'action:connect-provider',
        label: 'Connect a provider',
        kind: 'action',
        group: 'action',
        icon: CONCEPT_ICONS.providers,
        run: () => openSettingsDoor({ scope: 'providers' }),
      },
      {
        key: 'action:pair-device',
        label: NAMES.pairIphone,
        secondary: formerNamesOf(NAMES.pairIphone),
        kind: 'page',
        group: 'action',
        icon: Smartphone,
        run: () => dispatchWindowEvent({ name: 'goodboy:open-pair-device' }),
      },
      {
        key: 'help:guide',
        label: 'Guide',
        kind: 'help',
        group: 'help',
        icon: CONCEPT_ICONS.guide,
        run: () => dispatchWindowEvent({ name: 'goodboy:open-guide' }),
      },
      ...(hasWorkspace
        ? [
            {
              key: 'goto:changelog',
              label: NAMES.whatsNew,
              kind: 'help',
              group: 'help',
              icon: CONCEPT_ICONS.changelog,
              secondary: formerNamesOf(NAMES.whatsNew),
              run: openChangelogStudio,
            } satisfies PaletteEntry,
          ]
        : []),
      {
        key: 'help:shortcuts',
        label: 'Keyboard shortcuts',
        kind: 'help',
        group: 'help',
        icon: CONCEPT_ICONS.shortcuts,
        shortcut: 'settings.shortcuts',
        secondary: formerNamesOf(NAMES.keyboardShortcuts),
        run: () => openSettingsDoor({ scope: 'app', section: 'shortcuts' }),
      },
      {
        key: 'action:report-issue',
        label: 'Report a bug',
        kind: 'help',
        group: 'help',
        icon: CONCEPT_ICONS.reportIssue,
        shortcut: 'report.open',
        secondary: ['bug report issue feedback crash broken'],
        run: () => openReportSheet(),
      },
      ...guidePaletteEntries(),
    );
    return out;
  }, [
    workspaces,
    projects,
    sessions,
    everywhere,
    currentWorkspace,
    sessionId,
    projectPairs,
    agents,
    artifacts,
    plans,
    workflows,
    scripts,
    scriptPins,
    workspaceProjects,
    projectGitStatus,
    agentKindOverride,
    isAskOpen,
    isAskReplying,
    isInSession,
    destinations,
    openWorkspace,
    navigate,
    openStudio,
    switchStudio,
    toggleContextDrawer,
    runScript,
    reportError,
    markSessionsRead,
    unreadSessionIds,
    showToast,
    settingsGroups,
    innerColumn,
    canResumeSetup,
  ]);
};
