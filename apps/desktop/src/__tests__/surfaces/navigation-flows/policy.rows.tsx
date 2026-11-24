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

const RULE_LABEL = 'Provider priority';

const currentWorkspaceId = (): WorkspaceId => {
  const id = useAppStore.getState().currentWorkspaceId;
  if (id === null) {
    throw new Error('the board seed has no current workspace');
  }
  return id;
};

const spreadRule = (): boolean | undefined =>
  useAppStore.getState().workspaceOverrides[currentWorkspaceId()]?.workflowRules?.spreadByHeadroom;

const openModelsPolicy = async (): Promise<void> => {
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
  await openPalette(/^Workspace settings: Models/, 'Models');
  await heading('Models');
};

const flipRuleInProviders = async (): Promise<void> => {
  await openModelsPolicy();
  const rule = within(await screen.findByRole('tablist', { name: RULE_LABEL }));
  expect(rule.getByRole('tab', { name: 'By order' }).getAttribute('aria-selected')).toBe('true');
  await click(rule.getByRole('tab', { name: 'By load' }));
  await waitFor(() => expect(spreadRule()).toBe(true), WAIT);
};

const everyRunLeavesThePolicyToModels = async (): Promise<void> => {
  await screen.findByRole('region', { name: 'When a run stops for you' });
  await screen.findByRole('region', { name: 'Roles' });
  expect(useAppStore.getState().appStudio?.kind).toBe('workflow');
  expect(screen.queryByRole('button', { name: 'Open Models' })).toBeNull();
  expect(screen.queryByRole('tablist', { name: RULE_LABEL })).toBeNull();
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
    name: 'policy: Provider priority set in Models has no second control or link in Every run',
    covers: ['openSettings', 'studio:workflow', 'palette:Runs', 'settings:models'],
    door: 'palette',
    open: async () => {
      await flipRuleInProviders();
      await openPalette(/^Run defaults are in Workflows/, 'run defaults');
    },
    lands: everyRunLeavesThePolicyToModels,
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
      const panel = await screen.findByRole('region', { name: 'Publish this folder' });
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
      const panel = await screen.findByRole('region', { name: 'Publish this folder' });
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
