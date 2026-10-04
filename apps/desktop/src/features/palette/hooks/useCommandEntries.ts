import { useMemo } from 'react';
import { Plus, Smartphone } from 'lucide-react';
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
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { SHORTCUTS } from '../../../shared/keyboard/registry';
import { NAMES, formerNamesOf } from '../../../shared/names';
import { getAppliedTheme, useThemeStore } from '../../../shared/lib/theme';
import { classifyAgent } from '../../session/agent-kind';
import { useLensDestinations } from '../../session/hooks/useLensDestinations';
import { useSessionRefresh } from '../../session/hooks/useSessionRefresh';
import { openLens } from '../../session/openLens';
import { LENS_ICON } from '../../session/lens-labels';
import { requestNewSession } from '../../session/requestNewSession';
import { openReportSheet } from '../../bug-report/openReportSheet';
import { NOTIFICATIONS_STUDIO_EVENT } from '../../notifications/studioEvent';
import { openImpactStudio } from '../../impact/openImpactStudio';
import { openWorkflowRules } from '../../workflows/openWorkflowRules';
import { openChangelogStudio } from '../../changelog/changelogStudioEvent';
import { linkedProjectsLabel } from '../../workspace/linkedProjectsLabel';
import { useSettingsDirectory } from '../../settings/hooks/useSettingsDirectory';
import { settingsPaletteEntries } from '../../settings/settingsPaletteEntries';
import type { SettingsFocus } from '../../settings/settingsFocus';
import { useToast } from '../../../shared/components/Toast';
import { agentEntries } from '../sources/agentEntries';
import { artifactEntries } from '../sources/artifactEntries';
import { sessionEntries } from '../sources/sessionEntries';
import { workflowEntries } from '../sources/workflowEntries';
import { scriptPinEntries, type PinnedScriptTarget } from '../sources/scriptPinEntries';
import { useScriptPins } from '../../scripts';
import { runPinnedScript } from '../../scripts/runPinnedScript';
import { openSessionAnywhere } from '../openSessionAnywhere';
import type { PaletteEntry } from '../types';
import { useSessionsEverywhere } from './useSessionsEverywhere';
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
  const workflows = useAppStore((s) =>
    currentWorkspace ? (s.phaseTemplates[currentWorkspace.id] ?? EMPTY_ARRAY) : EMPTY_ARRAY,
  ) as ReadonlyArray<Workflow>;
  const attachWorkflowToSession = useAppStore((s) => s.attachWorkflowToSession);
  const agents = useAppStore((s) =>
    sessionId === null ? EMPTY_ARRAY : (s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY),
  );
  const artifacts = useAppStore((s) =>
    sessionId === null ? EMPTY_ARRAY : (s.sessionArtifacts[sessionId] ?? EMPTY_ARRAY),
  );
  const plans = useSessionPlans(sessionId);
  const agentKindOverride = useAppStore((s) => s.agentKindOverride);
  const destinations = useLensDestinations({ sessionId });
  const runScript = useAppStore((s) => s.runScript);
  const workspaceProjects = useMemo(
    () =>
      currentWorkspace === null
        ? []
        : projects.filter((project) => project.workspaceId === currentWorkspace.id),
    [projects, currentWorkspace],
  );
  const scriptPins = useScriptPins({ projectIds: workspaceProjects.map((project) => project.id) });
  const reportError = useAppStore((s) => s.reportError);
  const refreshSession = useSessionRefresh();
  const { showToast } = useToast();
  const theme = getAppliedTheme();
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

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

    if (sessionId !== null) {
      out.push(
        ...agentEntries({
          sessionId,
          agents,
          kindOf: ({ agent }) =>
            classifyAgent({ agent, override: agentKindOverride[agent.id as AgentId] ?? null }),
          open: ({ agentId }) => navigate({ to: agentPlace({ sessionId, agentId }) }),
        }),
        ...workflowEntries({
          workflows,
          start: (workflow) => {
            void attachWorkflowToSession(sessionId, workflow.id, { navigate: true })
              .then(() => showToast({ kind: 'success', message: `Started ${workflow.name}.` }))
              .catch((error: unknown) =>
                reportError({ title: `Couldn't start ${workflow.name}`, error, sessionId }),
              );
          },
        }),
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
        }),
      );
      for (const destination of destinations) {
        out.push({
          key: `lens:${destination.lens ?? 'overview'}`,
          label: `Open ${SHORTCUTS[destination.shortcut].label}`,
          kind: 'action',
          group: 'action',
          icon: destination.lens === null ? CONCEPT_ICONS.sessions : LENS_ICON[destination.lens],
          shortcut: destination.shortcut,
          secondary: formerNamesOf(SHORTCUTS[destination.shortcut].label),
          run: () => openLens({ sessionId, lens: destination.lens }),
        });
      }
      out.push(
        {
          key: 'action:context',
          label: SHORTCUTS['lens.context'].label,
          kind: 'action',
          group: 'action',
          icon: CONCEPT_ICONS.context,
          shortcut: 'lens.context',
          run: () => toggleContextDrawer({ sessionId }),
        },
        ...(currentSession?.archivedAt == null
          ? [
              {
                key: 'action:refresh',
                label: SHORTCUTS['session.refresh'].label,
                kind: 'action' as const,
                group: 'action' as const,
                icon: CONCEPT_ICONS.refresh,
                shortcut: 'session.refresh' as const,
                run: () => void refreshSession({ sessionId }),
              },
            ]
          : []),
        {
          key: 'goto:board',
          label: 'Back to board',
          kind: 'goto',
          group: null,
          icon: CONCEPT_ICONS.workspace,
          shortcut: 'session.board',
          run: () => navigate({ to: BOARD_PLACE }),
        },
      );
    }

    for (const workspace of workspaces) {
      out.push({
        key: `workspace:${workspace.id}`,
        label: workspace.name,
        kind: 'workspace',
        group: 'workspace',
        icon: CONCEPT_ICONS.workspace,
        detail: linkedProjectsLabel({ projects, workspaceId: workspace.id }),
        tag: 'Workspace',
        run: () =>
          void openWorkspace({ id: workspace.id, title: workspace.name, onRunning: 'new-window' }),
      });
    }

    if (hasWorkspace) {
      out.push(
        {
          key: 'goto:inbox',
          label: 'Inbox',
          kind: 'goto',
          group: null,
          icon: CONCEPT_ICONS.inbox,
          run: () => fire({ name: 'goodboy:open-inbox', detail: { door: true } }),
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
          key: 'goto:run-defaults',
          label: NAMES.runDefaults,
          kind: 'goto',
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
          kind: 'goto',
          group: null,
          icon: CONCEPT_ICONS.budget,
          run: () => openImpactStudio({ scope: { kind: 'spend' }, door: true }),
        },
        {
          key: 'goto:changelog',
          label: 'Changelog',
          kind: 'goto',
          group: null,
          icon: CONCEPT_ICONS.changelog,
          run: openChangelogStudio,
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
          kind: 'action',
          group: 'action',
          icon: Plus,
          shortcut: 'session.new',
          run: requestNewSession,
        },
      );
    }
    out.push(
      {
        key: 'goto:start-new-project',
        label: 'Start a new project',
        kind: 'goto',
        group: null,
        icon: Plus,
        run: () => fire({ name: 'goodboy:start-new-project' }),
      },
      {
        key: 'goto:add-workspace',
        label: 'Open a folder',
        kind: 'goto',
        group: null,
        icon: Plus,
        run: () => fire({ name: 'goodboy:add-workspace' }),
      },
    );

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

    for (const script of scripts) {
      out.push({
        key: `script:${script.id}`,
        label: script.name,
        kind: 'script',
        group: 'script',
        icon: CONCEPT_ICONS.scripts,
        detail: projectById(projects, script.projectId)?.name ?? 'Project script',
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

    out.push(
      {
        key: 'action:settings',
        label: 'Open settings',
        kind: 'action',
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
        run: () => toggleTheme(),
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
        label: 'Pair your iPhone',
        kind: 'action',
        group: 'action',
        icon: Smartphone,
        run: () => fire({ name: 'goodboy:open-pair-device' }),
      },
      {
        key: 'action:report-issue',
        label: 'Report a bug',
        kind: 'action',
        group: 'action',
        icon: CONCEPT_ICONS.reportIssue,
        shortcut: 'report.open',
        secondary: ['bug report issue feedback crash broken'],
        run: () => openReportSheet(),
      },
      {
        key: 'help:shortcuts',
        label: 'Keyboard shortcuts',
        kind: 'help',
        group: 'help',
        icon: CONCEPT_ICONS.shortcuts,
        shortcut: 'settings.shortcuts',
        run: () => openSettings({ scope: 'app', section: 'shortcuts' }),
      },
      {
        key: 'help:guide',
        label: 'Guide',
        kind: 'help',
        group: 'help',
        icon: CONCEPT_ICONS.guide,
        run: () => fire({ name: 'goodboy:open-guide' }),
      },
    );
    return out;
  }, [
    workspaces,
    projects,
    sessions,
    everywhere,
    currentWorkspace,
    currentSession,
    sessionId,
    projectPairs,
    agents,
    artifacts,
    plans,
    workflows,
    attachWorkflowToSession,
    scripts,
    scriptPins,
    workspaceProjects,
    agentKindOverride,
    destinations,
    openWorkspace,
    navigate,
    toggleContextDrawer,
    runScript,
    reportError,
    refreshSession,
    showToast,
    theme,
    toggleTheme,
    settingsGroups,
  ]);
};
