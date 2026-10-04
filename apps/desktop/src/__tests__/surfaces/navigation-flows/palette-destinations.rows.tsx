import { expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import {
  type Row,
  WAIT,
  band,
  both,
  click,
  clickButton,
  heading,
  lens,
  openCrumb,
  openPalette,
  useAppStore,
  visible,
} from './harness';

const openDiffHistory = async (): Promise<void> => {
  await openCrumb(/^Diff/);
  await clickButton(/Rewrite history/);
};

export const PALETTE_DESTINATION_ROWS: ReadonlyArray<Row> = [
  {
    name: 'rewrite history from the diff',
    covers: ['openRewriteHistory'],
    open: openDiffHistory,
    lands: () => heading('Rewrite history'),
  },
  {
    name: 'rewrite history draws the branch and its planned changes',
    covers: ['openRewriteHistory'],
    open: openDiffHistory,
    lands: both(
      () => visible('list', 'Commits'),
      () => heading('Planned changes'),
    ),
  },
  {
    name: 'branch history backups inside rewrite history',
    covers: ['openRewriteHistory'],
    open: async () => {
      await openDiffHistory();
      await clickButton('More history actions');
      await click(await screen.findByRole('menuitem', { name: /Backups/ }));
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
    name: 'palette: Show context',
    covers: ['toggleContextDrawer', 'palette:Show context'],
    open: () => openPalette(/^Show context/),
    lands: () => visible('region', 'Context'),
  },
  {
    name: 'palette: Refresh session',
    covers: ['resyncSession', 'palette:Refresh session'],
    open: () => openPalette(/^Refresh session/),
    lands: () => visible('button', /^Refresh(ing)?$/),
  },
  {
    name: 'palette: Back to board',
    covers: ['navigate', 'palette:Back to board'],
    open: () => openPalette(/^Back to board/),
    lands: () => heading('Board'),
  },
  {
    name: 'palette: Inbox',
    covers: ['openStudio', 'studio:inbox', 'palette:Inbox'],
    open: () => openPalette(/^Inbox$/),
    lands: both(
      () => band('Inbox'),
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
    open: () => openPalette(/^Run defaults/),
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
    open: () => openPalette(/^Impact: Spend/),
    lands: both(
      () => band('Impact'),
      () => heading('Spend'),
    ),
  },
  {
    name: 'palette: Changelog',
    covers: ['openStudio', 'studio:changelog', 'palette:Changelog'],
    open: () => openPalette(/^Changelog/),
    lands: both(
      () => band('Changelog'),
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
      () => band('Settings'),
      () => visible('textbox', 'Workspace name'),
    ),
  },
  {
    name: 'palette: Open settings',
    covers: ['openStudio', 'studio:settings', 'scope:home', 'palette:Open settings'],
    open: () => openPalette(/^Open settings/),
    lands: both(
      () => band('Settings'),
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
    open: () => clickButton(/^Create new session/),
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
      await clickButton(/^Create new session/);
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
      () => visible('button', /Untitled session/),
      async () => expect(await screen.findByTestId('context-chip')).toBeDefined(),
    ),
  },
  {
    name: 'palette: Connect a provider',
    covers: ['openStudio', 'scope:providers', 'palette:Connect a provider'],
    open: () => openPalette(/^Connect a provider/),
    lands: both(
      () => band('Settings'),
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
