import { expect, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { SessionId, StepId, Workflow, WorkflowId, WorkspaceId } from '@goodboy/types';
import { STORY_NOW } from '../../../store/storyHarness';
import {
  type Row,
  WAIT,
  settle,
  band,
  branchTab,
  both,
  click,
  clickButton,
  openWorktreeMenu,
  heading,
  lens,
  openCrumb,
  openPalette,
  settingsColumn,
  useAppStore,
  visible,
  getSection,
} from './harness';

const SHIP_ID = 'flow-workflow-ship-a-fix' as WorkflowId;

let pushed = vi.fn(async () => ({ ok: true }));
let opened = vi.fn(async () => undefined);
let spawned = vi.fn(async () => undefined);
let attached = vi.fn(async () => undefined);

const seedWorkflow = (): void => {
  const state = useAppStore.getState();
  const workspaceId = state.currentWorkspaceId as WorkspaceId;
  const workflow: Workflow = {
    id: SHIP_ID,
    workspaceId,
    name: 'Ship a fix',
    description: '',
    steps: ['Plan', 'Implement'].map((name, ordinal) => ({
      id: `${SHIP_ID}-step-${ordinal}` as StepId,
      workflowId: SHIP_ID,
      ordinal,
      name,
      promptPrefix: '',
    })),
    createdAt: STORY_NOW,
    updatedAt: STORY_NOW,
  };
  useAppStore.setState({
    attachWorkflowToSession: attached,
    phaseTemplates: { ...state.phaseTemplates, [workspaceId]: [workflow] },
  } as never);
};

const openDiffHistory = async (): Promise<void> => {
  await openWorktreeMenu();
  await click(await screen.findByRole('menuitem', { name: /^Rewrite history/ }));
};

export const PALETTE_DESTINATION_ROWS: ReadonlyArray<Row> = [
  {
    name: 'rewrite history opens the Commits tab',
    covers: ['openRewriteHistory'],
    open: openDiffHistory,
    lands: branchTab('commits'),
  },
  {
    name: 'the Commits tab draws the branch and the keys hint, with no plan at rest',
    covers: ['openRewriteHistory'],
    open: openDiffHistory,
    lands: both(
      () => visible('list', 'Commits'),
      () => visible('button', 'Keys'),
    ),
  },
  {
    name: 'previous versions drawer from the Commits tab',
    covers: ['openRewriteHistory'],
    open: async () => {
      await openDiffHistory();
      await clickButton(/^Show previous versions/);
    },
    lands: () => visible('region', 'Previous versions'),
  },
  {
    name: 'context drawer from the session tools',
    covers: ['openContextDrawer', 'drawer:context'],
    open: async () => click(await screen.findByTestId('pane-toggle-context')),
    lands: () => visible('region', 'Context'),
  },
  {
    name: 'Ask drawer from the session tools',
    covers: ['openAsk', 'drawer:ask'],
    open: async () => click(await screen.findByTestId('pane-toggle-ask')),
    lands: () => visible('region', 'Ask'),
  },
  {
    name: 'palette: Show context',
    covers: ['toggleContextDrawer', 'palette:Show context'],
    open: () => openPalette(/^Show context/, 'show context'),
    lands: () => visible('region', 'Context'),
  },
  {
    name: 'palette: Refresh session',
    covers: ['resyncSession', 'palette:Refresh session'],
    open: () => openPalette(/^Refresh session/, 'refresh session'),
    lands: () => visible('button', 'More session actions'),
  },
  {
    name: 'palette: Board',
    covers: ['navigate', 'palette:Board'],
    open: () => openPalette(/^Board$/),
    lands: () => heading('Sessions'),
  },
  {
    name: 'palette: Chat',
    covers: ['openStudio', 'studio:chat', 'palette:Chat'],
    door: 'palette',
    open: () => openPalette(/^Chat$/),
    lands: () => band('Chat'),
  },
  {
    name: 'palette: Terminal',
    covers: ['studio:terminal', 'palette:Terminal'],
    door: 'palette',
    open: () => openPalette(/^Terminal$/),
    lands: () => band('Terminal'),
  },
  {
    name: 'palette: New terminal in this session',
    covers: ['palette:New terminal'],
    door: 'palette',
    open: () => openPalette(/^New terminal in this session$/, 'new terminal'),
    lands: async () => {
      await screen.findByRole('button', { name: 'Open on Terminal page' }, WAIT);
      expect(useAppStore.getState().drawer?.kind).toBe('terminal');
      expect(useAppStore.getState().appStudio).toBeNull();
    },
  },
  {
    name: 'palette verb: Open a worktree in terminal',
    covers: ['palette:Open a worktree in terminal'],
    seed: 'pr',
    door: 'palette',
    open: async () => {
      await openPalette(/^Open a worktree in terminal/);
      const [choice] = await screen.findAllByRole('option', { name: /in terminal/ });
      if (choice === undefined) {
        throw new Error('The palette offers no worktree to open');
      }
      fireEvent.mouseDown(choice);
      await settle();
    },
    lands: async () => {
      await screen.findByRole('button', { name: 'Open on Terminal page' }, WAIT);
      expect(useAppStore.getState().drawer?.kind).toBe('terminal');
      expect(useAppStore.getState().appStudio).toBeNull();
    },
  },
  {
    name: 'palette: All actions for this session',
    covers: ['palette:All actions for this session'],
    seed: 'pr',
    open: () => openPalette(/^All actions for this session/),
    lands: async () => {
      expect(await screen.findByText('Copy and export', {}, WAIT)).toBeDefined();
      expect(screen.getByText('Danger')).toBeDefined();
      expect(screen.getByPlaceholderText('Filter actions…')).toBeDefined();
    },
  },
  {
    name: 'palette next step: Push the branch',
    covers: ['pushSessionBranch', 'palette:Push the branch'],
    seed: 'pr',
    open: async () => {
      pushed = vi.fn(async () => ({ ok: true }));
      useAppStore.setState({ pushSessionBranch: pushed } as never);
      await openPalette(/^Push the branch/);
    },
    lands: () => waitFor(() => expect(pushed).toHaveBeenCalledTimes(1), WAIT),
  },
  {
    name: 'palette next step: Open a pull request',
    covers: ['navigate', 'palette:Open a pull request for ledger-core'],
    seed: 'pr',
    open: async () => {
      opened = vi.fn(async () => undefined);
      useAppStore.setState({ createPrForSession: opened } as never);
      await openPalette(/^Open a pull request for ledger-core/);
    },
    lands: async () => {
      await waitFor(
        () => expect(getSection(/^Pull request/).getAttribute('aria-current')).toBe('page'),
        WAIT,
      );
      expect(opened).not.toHaveBeenCalled();
    },
  },
  {
    name: 'palette next step: Review the changes',
    covers: ['spawnAgent', 'palette:Review the changes'],
    seed: 'pr',
    open: async () => {
      spawned = vi.fn(async () => undefined);
      useAppStore.setState({ spawnAgent: spawned } as never);
      await openPalette(/^Review the changes/);
    },
    lands: () =>
      waitFor(
        () =>
          expect(spawned).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ kindOverride: 'reviewer' }),
          ),
        WAIT,
      ),
  },
  {
    name: 'palette: Pull main in all linked repos pulls every repo and says so',
    covers: ['palette:Pull main in all linked repos'],
    seed: 'pr',
    open: () => openPalette(/^Pull main in all linked repos/, 'pull main'),
    lands: async () => {
      expect(await screen.findByText('Updated 3 repos', {}, WAIT)).toBeDefined();
    },
  },
  ...['payments-api', 'notify-relay', 'ledger-core'].map((repo): Row => ({
    name: `palette: Pull the default branch in ${repo} pulls that repo only`,
    covers: [`palette:Pull the default branch in ${repo}`],
    seed: 'pr',
    open: () => openPalette(new RegExp(`^Pull the default branch in ${repo}`), `pull ${repo}`),
    lands: async () => {
      expect(await screen.findByText('Updated 1 repo', {}, WAIT)).toBeDefined();
      expect(screen.getByText(new RegExp(`^${repo}: main updated`))).toBeDefined();
    },
  })),
  {
    name: 'palette: Start a run lists the workflows and asks before it starts anything',
    covers: ['palette:Start a run'],
    open: async () => {
      attached = vi.fn(async () => undefined);
      seedWorkflow();
      await openPalette(/^Start a run$/, 'start a run');
      fireEvent.mouseDown(await screen.findByRole('option', { name: /^Ship a fix/ }));
      await settle();
    },
    lands: async () => {
      expect(await screen.findByText('Start a run: Ship a fix', {}, WAIT)).toBeDefined();
      expect(screen.getByText('Plan · Implement')).toBeDefined();
      expect(attached).not.toHaveBeenCalled();
    },
  },
  {
    name: 'palette: confirming Start a run attaches the workflow to this session',
    covers: ['attachWorkflowToSession', 'palette:Start a run: Ship a fix'],
    open: async () => {
      attached = vi.fn(async () => undefined);
      seedWorkflow();
      await openPalette(/^Start a run: Ship a fix/, 'ship a fix');
      await clickButton('Start run');
    },
    lands: ({ sessionId }) =>
      waitFor(
        () =>
          expect(attached).toHaveBeenCalledWith(
            sessionId,
            SHIP_ID,
            expect.objectContaining({ navigate: true }),
          ),
        WAIT,
      ),
  },
  {
    name: 'palette: Tasks',
    covers: ['openStudio', 'studio:inbox', 'palette:Tasks'],
    door: 'palette',
    open: () => openPalette(/^Tasks$/),
    lands: both(
      () => band('Tasks'),
      () => heading(/^[\d,]+ open$/),
    ),
  },
  {
    name: 'palette: Workflows',
    covers: ['openStudio', 'studio:workflow', 'palette:Workflows'],
    door: 'palette',
    open: () => openPalette(/^Workflows$/),
    lands: both(
      () => band('Workflows'),
      () => visible('button', 'New workflow'),
    ),
  },
  {
    name: 'palette: Run defaults',
    covers: ['studio:workflow', 'palette:Run defaults'],
    door: 'palette',
    open: () => openPalette(/^Run defaults/, 'run defaults'),
    lands: both(
      () => band('Workflows'),
      () => heading('Run defaults'),
    ),
  },
  {
    name: 'palette: Impact',
    covers: ['openStudio', 'studio:impact', 'palette:Impact'],
    door: 'palette',
    open: () => openPalette(/^Impact$/),
    lands: () => band('Impact'),
  },
  {
    name: 'palette: Impact: Spend',
    covers: ['openStudio', 'studio:impact', 'palette:Impact: Spend'],
    door: 'palette',
    open: () => openPalette(/^Impact: Spend/, 'impact spend'),
    lands: both(
      () => band('Impact'),
      () => heading('Spend'),
    ),
  },
  {
    name: "palette: What's new",
    covers: ['openStudio', 'studio:changelog', "palette:What's new"],
    door: 'palette',
    open: () => openPalette(/^What's new/),
    lands: both(
      () => band("What's new"),
      () => heading(/^Goodboy \d/),
    ),
  },
  {
    name: 'palette: Notifications',
    covers: ['openStudio', 'studio:notifications', 'palette:Notifications'],
    door: 'palette',
    open: () => openPalette(/^Notifications/),
    lands: both(
      () => band('Notifications'),
      () => heading('Notifications'),
    ),
  },
  {
    name: 'palette: Workspace settings',
    covers: ['openStudio', 'studio:settings', 'scope:workspace', 'palette:Workspace settings'],
    door: 'palette',
    open: () => openPalette(/^Workspace settings: Projects/, 'workspace settings projects'),
    lands: both(
      () => settingsColumn(),
      () => visible('textbox', 'Workspace name'),
    ),
  },
  {
    name: 'palette: Settings',
    covers: ['openStudio', 'studio:settings', 'scope:home', 'palette:Settings'],
    door: 'palette',
    open: () => openPalette(/^Settings$/),
    lands: both(
      () => settingsColumn(),
      () => visible('navigation', 'Settings scopes'),
    ),
  },
  {
    name: 'palette: New chat',
    covers: ['openStudio', 'studio:chat', 'palette:New chat'],
    door: 'palette',
    open: () => openPalette(/^New chat/),
    lands: () => band('Chat'),
  },
  {
    name: 'palette: New session',
    covers: ['openSessionDraft', 'palette:New session'],
    open: () => openPalette(/^New session/),
    lands: () => heading('New session'),
  },
  {
    name: 'sidebar: New opens the kickoff',
    covers: ['openSessionDraft', 'button:New'],
    open: () => clickButton(/^New session$/),
    lands: both(
      () => heading('New session'),
      () => visible('tab', /Pick up a task/),
      () => visible('tab', /Run a workflow/),
      () => visible('tab', /Ask an agent/),
      () => visible('button', /Start blank/),
    ),
  },
  {
    name: 'kickoff: Start blank lands on the overview',
    covers: ['startBlankSession'],
    open: async (ctx) => {
      const seeded = useAppStore.getState().sessions.find((s) => s.id === ctx.sessionId)!;
      useAppStore.setState({
        createSession: async () => {
          const session = {
            ...seeded,
            id: 'session-blank-start' as SessionId,
            goal: '',
            workflowRuns: [],
          };
          useAppStore.setState((state) => ({
            sessions: [session, ...state.sessions],
            currentSessionId: session.id,
            sessionPhaseRuns: { ...state.sessionPhaseRuns, [session.id]: [] },
            sessionSlots: { ...state.sessionSlots, [session.id]: [] },
            sessionLoading: {
              ...state.sessionLoading,
              [session.id]: {
                agents: false,
                transcript: false,
                telemetry: false,
                slots: false,
                plans: false,
                summary: false,
              },
            },
            sessionProjectMounts: { ...state.sessionProjectMounts, [session.id]: [] },
          }));
          return { session };
        },
      } as never);
      await clickButton(/^New session$/);
      await clickButton(/Start blank/);
    },
    lands: both(
      async (ctx) => {
        await waitFor(() => {
          const state = useAppStore.getState();
          expect(state.currentSessionId).not.toBe(ctx.sessionId);
          expect(state.openSessionDraftWorkspaceId).toBeNull();
        }, WAIT);
      },
      async () =>
        expect(
          (await screen.findAllByRole('button', { name: /^Untitled session$/ }, WAIT)).length,
        ).toBeGreaterThan(0),
      async () => expect(await screen.findByTestId('session-tools')).toBeDefined(),
    ),
  },
  {
    name: 'palette: Connect a provider',
    covers: ['openStudio', 'scope:providers', 'palette:Connect a provider'],
    open: () => openPalette(/^Connect a provider/),
    lands: both(
      () => settingsColumn(),
      () => visible('region', 'Providers'),
    ),
  },
  {
    name: 'palette: Pair your iPhone',
    covers: ['openStudio', 'studio:companion', 'palette:Pair your iPhone'],
    door: 'palette',
    open: () => openPalette(/^Pair your iPhone/),
    lands: () => band('Pair device'),
  },
  {
    name: 'palette: Report a bug',
    covers: ['palette:Report a bug'],
    open: () => openPalette(/^Report a bug/),
    lands: () => visible('dialog', 'Report a bug'),
  },
  {
    name: 'palette: Keyboard shortcuts',
    covers: ['openStudio', 'settings:shortcuts', 'palette:Keyboard shortcuts'],
    open: () => openPalette(/^Keyboard shortcuts/),
    lands: () => heading('Shortcuts'),
  },
  {
    name: 'palette: Guide',
    covers: ['openStudio', 'studio:guide', 'palette:Guide'],
    door: 'palette',
    open: () => openPalette(/^Guide/),
    lands: () => band('Guide'),
  },
  {
    name: 'palette verb: Rename',
    covers: ['palette:Rename'],
    open: () => openPalette(/^Rename$/),
    lands: () => visible('textbox', 'Session title'),
  },
  {
    name: 'palette verb: Start agent',
    covers: ['navigate', 'palette:Start agent'],
    open: () => openPalette(/^Start agent$/),
    lands: both(lens('agents'), () => heading('Agents')),
  },
  {
    name: 'palette verb: Link work',
    covers: ['palette:Link work'],
    open: () => openPalette(/^Link work$/),
    lands: () => visible('dialog', 'Link work'),
  },
];
