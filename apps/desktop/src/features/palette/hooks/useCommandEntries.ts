import { useMemo } from 'react';
import { CircleArrowUp, PanelLeft, Plus, RotateCcw, Smartphone } from 'lucide-react';
import { useCurrentInnerColumn } from '@goodboy/ui';
import type { AgentId, Project, ProjectScript, SessionId } from '@goodboy/types';
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
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { SHORTCUTS } from '../../../shared/keyboard/registry';
import { NAMES, formerNamesOf } from '../../../shared/names';
import { getAppliedTheme, oppositeOfApplied, switchTheme } from '../../../shared/lib/theme';
import { classifyAgent } from '../../session/agent-kind';
import { useLensDestinations } from '../../session/hooks/useLensDestinations';
import { openLens } from '../../session/openLens';
import { LENS_ICON } from '../../session/lens-labels';
import { requestNewSession } from '../../session/requestNewSession';
import { openReportSheet } from '../../bug-report/openReportSheet';
import { NOTIFICATIONS_STUDIO_EVENT } from '../../notifications/studioEvent';
import { terminalStudioPlace } from '../../terminal/terminalStudioPlace';
import { openSessionTerminalHere } from '../../terminal/openSessionTerminalHere';
import { openWorkspaceTerminal } from '../../terminal/openWorkspaceTerminal';
import { openImpactStudio } from '../../impact/openImpactStudio';
import { openWorkflowRules } from '../../workflows/openWorkflowRules';
import { openChangelogStudio } from '../../changelog/changelogStudioEvent';
import { folderCountLabel } from '../../workspace/folderCountLabel';
import { openNewWorkspace } from '../../workspace/openNewWorkspace';
import { useIsMainWindow } from '../../workspace/useIsMainWindow';
import { getWizardState, resumeSetup } from '../../onboarding/onboarding-store';
import { useSettingsDirectory } from '../../settings/hooks/useSettingsDirectory';
import { settingsPaletteEntries } from '../../settings/settingsPaletteEntries';
import { guidePaletteEntries } from '../../settings/guidePaletteEntries';
import { checkForUpdatesNow } from '../checkForUpdatesNow';
import type { SettingsFocus } from '../../settings/settingsFocus';
import { useToast } from '../../../shared/components/Toast';
import { agentEntries } from '../sources/agentEntries';
import { openPlanAnywhere } from '../../plans/openPlanAnywhere';
import { requestAskReset } from '../../session/ask/requestAskReset';
import { isAskStreaming } from '../../../store/slices/ask/isAskStreaming';
import { selectOpenDrawer } from '../../../store/slices/drawer/selectOpenDrawer';
import { artifactEntries } from '../sources/artifactEntries';
import { sessionEntries } from '../sources/sessionEntries';
import { workflowEntries } from '../sources/workflowEntries';
import { scriptPinEntries, type PinnedScriptTarget } from '../sources/scriptPinEntries';
import { useScriptPins } from '../../scripts';
import { runPinnedScript } from '../../scripts/runPinnedScript';
import { pullBaseInRepos } from '../../workspace/pullBase/pullBaseInRepos';
import { pullBaseSummary } from '../../workspace/pullBase/pullBaseSummary';
import { repoEntries } from '../sources/repoEntries';
import { openSessionAnywhere } from '../openSessionAnywhere';
import type { PaletteEntry } from '../types';
import { useSessionsEverywhere } from './useSessionsEverywhere';
import { useStartRun } from './useStartRun';
import { projectById } from '../../../store/slices/projects/projectIndex';

const PAIR_SEPARATOR = '\u0000';

const LIST_SEPARATOR = '\u0001';

type EventParams = {
  readonly name: string;
  readonly detail?: unknown;
};

const fire = ({ name, detail }: EventParams): void => {
  window.dispatchEvent(
    detail === undefined ? new CustomEvent(name) : new CustomEvent(name, { detail }),
  );
};

const openNotificationsDoor = (): boolean =>
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_STUDIO_EVENT, { detail: { door: true } }));

const openSettings = (focus: SettingsFocus): void =>
  fire({ name: 'goodboy:open-settings', detail: { ...focus, door: true } });

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
  const { workflows, start: startRun } = useStartRun();
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
  const { showToast } = useToast();
  const theme = getAppliedTheme();
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
        label: 'Reset chat',
        secondary: ['Reset Ask', 'New Ask chat'],
        kind: 'action',
        group: 'action',
        icon: RotateCcw,
        shortcut: 'ask.reset',
        run: () => {
          requestAskReset({ sessionId });
        },
      });
    }

    if (sessionId !== null) {
      out.push(
        ...agentEntries({
          sessionId,
          agents,
          kindOf: ({ agent }) =>
            classifyAgent({ agent, override: agentKindOverride[agent.id as AgentId] ?? null }),
          open: ({ agentId }) => navigate({ to: agentPlace({ sessionId, agentId }) }),
        }),
        ...workflowEntries({ workflows, start: startRun }),
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
        out.push({
          key: `lens:${destination.lens ?? 'overview'}`,
          label: `Open ${SHORTCUTS[destination.shortcut].label}`,
          kind: 'page',
          group: 'action',
          icon: destination.lens === null ? CONCEPT_ICONS.sessions : LENS_ICON[destination.lens],
          shortcut: destination.shortcut,
          secondary: formerNamesOf(SHORTCUTS[destination.shortcut].label),
          run: () => openLens({ sessionId, lens: destination.lens }),
        });
      }
      out.push({
        key: 'action:context',
        label: SHORTCUTS['lens.context'].label,
        kind: 'page',
        group: 'action',
        icon: CONCEPT_ICONS.context,
        shortcut: 'lens.context',
        run: () => toggleContextDrawer({ sessionId }),
      });
    }

    for (const workspace of workspaces) {
      out.push({
        key: `workspace:${workspace.id}`,
        label: workspace.name,
        kind: 'workspace',
        group: 'workspace',
        icon: CONCEPT_ICONS.workspace,
        detail: folderCountLabel({ projects, workspaceId: workspace.id }),
        tag: 'Workspace',
        run: () =>
          void openWorkspace({ id: workspace.id, title: workspace.name, onRunning: 'new-window' }),
      });
    }

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
          run: () => fire({ name: 'goodboy:open-inbox', detail: { door: true } }),
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
          run: () => fire({ name: 'goodboy:open-workflow-studio', detail: { door: true } }),
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
          run: openWorkflowRules,
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
              action: { kind: 'open-lens', sessionId, lens: 'scripts' },
            });
            return;
          }
          showToast({ kind: 'success', message: `${target.name} finished.` });
        })
        .catch((error: unknown) => reportError({ title: failureTitle, error, sessionId }));
    };
    out.push(
      ...scriptPinEntries({
        projects: workspaceProjects,
        pins: scriptPins,
        saved: scripts,
        run: runPinned,
      }),
    );

    const pullRepos = (repos: ReadonlyArray<Project>): void => {
      showToast({
        kind: 'info',
        title: `Pulling in ${repos.length} ${repos.length === 1 ? 'repo' : 'repos'}…`,
        message: repos.map((repo) => repo.name).join(', '),
        dedupeKey: 'pull-base',
      });
      void pullBaseInRepos({ projects: repos })
        .then((outcomes) => {
          const summary = pullBaseSummary({ outcomes });
          showToast({
            kind: summary.kind,
            title: summary.title,
            message: summary.lines.join('\n'),
            dedupeKey: 'pull-base',
          });
          for (const outcome of outcomes) {
            if (outcome.kind === 'updated') {
              void useAppStore.getState().loadProjectGitStatus({ projectId: outcome.projectId });
            }
          }
        })
        .catch((error: unknown) => reportError({ title: 'Could not pull the base branch', error }));
    };
    out.push(
      ...repoEntries({ projects: workspaceProjects, statuses: projectGitStatus, pull: pullRepos }),
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
                  action: { kind: 'open-lens', sessionId, lens: 'scripts' },
                });
                return;
              }
              showToast({ kind: 'success', message: `${script.name} finished.` });
            })
            .catch((error: unknown) => reportError({ title: failureTitle, error, sessionId }));
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
        run: () => openSettings({ scope: 'home' }),
      },
      ...settingsPaletteEntries({ groups: settingsGroups, open: openSettings }).filter(
        (entry) => entry.key !== 'setting:app:shortcuts',
      ),
      {
        key: 'action:toggle-theme',
        label: theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
        kind: 'action',
        group: 'action',
        icon: CONCEPT_ICONS.appearance,
        secondary: ['theme appearance'],
        run: () => switchTheme({ to: oppositeOfApplied() }),
      },
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
        run: () => openSettings({ scope: 'providers' }),
      },
      {
        key: 'action:pair-device',
        label: NAMES.pairIphone,
        secondary: formerNamesOf(NAMES.pairIphone),
        kind: 'page',
        group: 'action',
        icon: Smartphone,
        run: () => fire({ name: 'goodboy:open-pair-device' }),
      },
      {
        key: 'help:guide',
        label: 'Guide',
        kind: 'help',
        group: 'help',
        icon: CONCEPT_ICONS.guide,
        run: () => fire({ name: 'goodboy:open-guide' }),
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
        run: () => openSettings({ scope: 'app', section: 'shortcuts' }),
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
    startRun,
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
    showToast,
    theme,
    settingsGroups,
    innerColumn,
    canResumeSetup,
  ]);
};
