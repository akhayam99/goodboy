import { expect, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { DEFAULT_WORKFLOW_RULES, type ProjectId, type WorkspaceId } from '@goodboy/types';
import { seedPolicyScene } from '../../../app/components/MockScene/scenes/providerPolicySeed';
import { STORY_NOW } from '../../../store/storyHarness';
import {
  type Ctx,
  type Row,
  WAIT,
  click,
  clickButton,
  heading,
  openPalette,
  useAppStore,
} from './harness';

const SPREAD_LABEL = 'Send new steps to the provider with the most room';

const currentWorkspaceId = (): WorkspaceId => {
  const id = useAppStore.getState().currentWorkspaceId;
  if (id === null) {
    throw new Error('the board seed has no current workspace');
  }
  return id;
};

const spreadRule = (): boolean | undefined =>
  useAppStore.getState().workspaceOverrides[currentWorkspaceId()]?.workflowRules?.spreadByHeadroom;

const openProvidersPolicy = async (): Promise<void> => {
  const workspaceId = currentWorkspaceId();
  seedPolicyScene({ workspaceId });
  const seeded = useAppStore.getState().workspaceOverrides[workspaceId];
  if (seeded === undefined) {
    throw new Error('the board seed has no overrides for its workspace');
  }
  useAppStore.setState({
    workspaceOverrides: {
      ...useAppStore.getState().workspaceOverrides,
      [workspaceId]: {
        ...seeded,
        workflowRules: { ...DEFAULT_WORKFLOW_RULES, spreadByHeadroom: false },
      },
    },
  });
  await openPalette(/^Providers: Models/, 'Models');
  await heading('Models');
  await click(await screen.findByRole('button', { name: /^Claude, Codex/, expanded: false }));
};

const flipSpreadInProviders = async (): Promise<void> => {
  await openProvidersPolicy();
  const dialog = await screen.findByRole('dialog', { name: 'When a provider is out' });
  const toggle = within(dialog).getByRole('switch', { name: SPREAD_LABEL });
  expect(toggle.getAttribute('aria-checked')).toBe('false');
  await click(toggle);
  await waitFor(() => expect(spreadRule()).toBe(true), WAIT);
};

const runDefaultsShowsALink = async (): Promise<void> => {
  await heading('Run defaults');
  const band = await screen.findByRole('region', { name: 'Providers' });
  expect(within(band).getByRole('button', { name: 'Open Providers & models' })).toBeDefined();
  expect(within(band).getByTestId('rules-policy-summary').textContent).toMatch(/^Claude, Codex/);
  expect(within(band).queryAllByRole('switch')).toEqual([]);
  expect(screen.queryByRole('switch', { name: SPREAD_LABEL })).toBeNull();
};

const startFirstLap = ({ sessionId }: Ctx): ProjectId => {
  const state = useAppStore.getState();
  const session = state.sessions.find((candidate) => candidate.id === sessionId);
  const project = state.projects.find(
    (candidate) => candidate.workspaceId === session?.workspaceId && candidate.kind === 'repo',
  );
  if (project === undefined) {
    throw new Error('the board seed has no repository project');
  }
  useAppStore.setState({
    projects: state.projects.map((candidate) =>
      candidate.id === project.id ? { ...candidate, remoteUrl: undefined } : candidate,
    ),
    sessionProjectMounts: { ...state.sessionProjectMounts, [sessionId]: [] },
    sessionMounts: { ...state.sessionMounts, [sessionId]: [] },
    bootstrapPhase: {
      ...state.bootstrapPhase,
      [project.id]: {
        stage: 'first-lap',
        firstLapSessionId: sessionId,
        bootstrapSessionId: null,
        snapshotId: null,
        worktreePath: null,
        branch: null,
        updatedAt: STORY_NOW,
      },
    },
    githubStatus: { available: false, mode: 'absent', scopes: [], scoped: false },
  });
  return project.id;
};

const INSTALL_COMMAND = 'brew install gh';

export const POLICY_ROWS: ReadonlyArray<Row> = [
  {
    name: 'policy: the spread option set in Providers is a link, not a second switch, in Run defaults',
    covers: ['openSettings', 'studio:workflow', 'palette:Run defaults', 'scope:providers'],
    open: async () => {
      await flipSpreadInProviders();
      await openPalette(/^Run defaults/, 'run defaults');
    },
    lands: runDefaultsShowsALink,
  },
  {
    name: 'policy: the link in Run defaults opens Providers & models on the same policy',
    covers: ['openSettings', 'studio:workflow', 'palette:Run defaults', 'scope:providers'],
    open: async () => {
      await flipSpreadInProviders();
      await openPalette(/^Run defaults/, 'run defaults');
      await runDefaultsShowsALink();
      await clickButton('Open Providers & models');
    },
    lands: async () => {
      await heading('Models');
      await click(await screen.findByRole('button', { name: /^Claude, Codex/, expanded: false }));
      const dialog = await screen.findByRole('dialog', { name: 'When a provider is out' });
      expect(
        within(dialog).getByRole('switch', { name: SPREAD_LABEL }).getAttribute('aria-checked'),
      ).toBe('true');
    },
  },
  {
    name: 'first lap: gh missing, copy the install command, press Check again, then the signed-in form',
    covers: ['firstLap:publish', 'firstLap:gh-missing'],
    open: async (ctx) => {
      const writeText = vi.fn(async () => undefined);
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Macintosh; Mac OS X)');
      startFirstLap(ctx);
      const refresh = vi.fn(async () => {
        useAppStore.setState({
          githubStatus: {
            available: true,
            mode: 'gh-cli',
            user: 'dana-reyes',
            scopes: [],
            scoped: false,
          },
        });
      });
      useAppStore.setState({ refreshGithubStatus: refresh });

      await clickButton('Publish');
      const panel = await screen.findByRole('region', { name: 'Publish this project' });
      expect(
        within(panel)
          .getByRole('tab', { name: 'Use an existing repository' })
          .getAttribute('aria-selected'),
      ).toBe('true');
      await click(within(panel).getByRole('tab', { name: 'Create on GitHub' }));
      expect(within(panel).queryByRole('button', { name: /^Publish/ })).toBeNull();
      await click(within(panel).getByRole('button', { name: 'Copy text' }));
      await waitFor(() => expect(writeText).toHaveBeenCalledExactlyOnceWith(INSTALL_COMMAND), WAIT);
      await click(within(panel).getByRole('button', { name: 'Check again' }));
      expect(refresh).toHaveBeenCalledOnce();
    },
    lands: async () => {
      const panel = await screen.findByRole('region', { name: 'Publish this project' });
      expect(
        await within(panel).findByText('Connected as dana-reyes', undefined, WAIT),
      ).toBeDefined();
      expect(within(panel).getByLabelText('Repository name')).toBeDefined();
      expect(within(panel).queryByText("GitHub's command line tool isn't installed")).toBeNull();
      expect(within(panel).queryByRole('button', { name: /^Publish/ })).toBeNull();
      expect(within(panel).getByRole('button', { name: 'Cancel' })).toBeDefined();
    },
  },
];
