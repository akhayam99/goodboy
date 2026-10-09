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
  clickFirstButton,
  heading,
  lens,
  openCrumb,
  openPalette,
  settingsColumn,
  useAppStore,
  visible,
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
  await clickFirstButton(/ on .+ actions$/);
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
    name: 'the Commits tab draws the branch and its planned changes',
    covers: ['openRewriteHistory'],
    open: openDiffHistory,
    lands: both(
      () => visible('list', 'Commits'),
      () => heading('Planned changes'),
    ),
  },
  {
    name: 'branch history backups inside the Commits tab',
    covers: ['openRewriteHistory'],
    open: async () => {
      await openDiffHistory();
      await clickButton(/^Backups/);
    },
    lands: () => visible('region', 'Backups'),
  },
  {
    name: 'context drawer from the overview chip',
    covers: ['openContextDrawer', 'drawer:context'],
    open: async () => click(await screen.findByTestId('context-chip')),
    lands: () => visible('region', 'Context'),
  },
  {
    name: 'Ask drawer from the trail band',
    covers: ['openAsk', 'drawer:ask'],
    open: async () => click(await screen.findByTestId('ask-trail-button')),
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
    lands: () => heading('Board'),
  },
  {
    name: 'palette: Chat',
    covers: ['openStudio', 'studio:chat', 'palette:Chat'],
    open: () => openPalette(/^Chat$/),
    lands: () => band('Chat'),
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
    covers: ['createPrForSession', 'palette:Open a pull request for ledger-core'],
    seed: 'pr',
    open: async () => {
      opened = vi.fn(async () => undefined);
      useAppStore.setState({ createPrForSession: opened } as never);
      await openPalette(/^Open a pull request for ledger-core/);
    },
    lands: () => waitFor(() => expect(opened).toHaveBeenCalledTimes(1), WAIT),
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
    open: () => openPalette(/^Tasks$/),
    lands: both(
      () => band('Tasks'),
      () => heading('All items'),
    ),
  },
  {
    name: 'palette: Workflows',
    covers: ['openStudio', 'studio:workflow', 'palette:Workflows'],
    open: () => openPalette(/^Workflows$/),
    lands: both(
      () => band('Workflows'),
      () => visible('button', 'New workflow'),
    ),
  },
  {
    name: 'palette: Run defaults',
    covers: ['studio:workflow', 'palette:Run defaults'],
    open: () => openPalette(/^Run defaults/, 'run defaults'),
    lands: both(
      () => band('Workflows'),
      () => heading('Run defaults'),
    ),
  },
  {
    name: 'palette: Impact',
    covers: ['openStudio', 'studio:impact', 'palette:Impact'],
    open: () => openPalette(/^Impact$/),
    lands: () => band('Impact'),
  },
  {
    name: 'palette: Impact: Spend',
    covers: ['openStudio', 'studio:impact', 'palette:Impact: Spend'],
    open: () => openPalette(/^Impact: Spend/, 'impact spend'),
    lands: both(
      () => band('Impact'),
      () => heading('Spend'),
    ),
  },
  {
    name: "palette: What's new",
    covers: ['openStudio', 'studio:changelog', "palette:What's new"],
    open: () => openPalette(/^What's new/),
    lands: both(
      () => band("What's new"),
      () => heading(/^Goodboy \d/),
    ),
  },
  {
    name: 'palette: Notifications',
    covers: ['openStudio', 'studio:notifications', 'palette:Notifications'],
    open: () => openPalette(/^Notifications/),
    lands: both(
      () => band('Notifications'),
      () => heading('All notifications'),
    ),
  },
  {
    name: 'palette: Workspace settings',
    covers: ['openStudio', 'studio:settings', 'scope:workspace', 'palette:Workspace settings'],
    open: () => openPalette(/^Workspace settings: Projects/, 'workspace settings projects'),
    lands: both(
      () => settingsColumn(),
      () => visible('textbox', 'Workspace name'),
    ),
  },
  {
    name: 'palette: Settings',
    covers: ['openStudio', 'studio:settings', 'scope:home', 'palette:Settings'],
    open: () => openPalette(/^Settings$/),
    lands: both(
      () => settingsColumn(),
      () => visible('navigation', 'Settings scopes'),
    ),
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
      () => visible('button', /^Untitled session$/),
      async () => expect(await screen.findByTestId('context-chip')).toBeDefined(),
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
