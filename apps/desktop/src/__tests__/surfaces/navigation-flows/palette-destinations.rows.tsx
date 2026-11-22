import { expect, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import { switchSessionFace } from '../../../features/session/components/SessionDesk/switchSessionFace';
import { shortcutGlyphs } from '../../../shared/keyboard/registry';
import {
  type Row,
  WAIT,
  settle,
  studio,
  branchTab,
  both,
  click,
  clickButton,
  openWorktreeMenu,
  heading,
  lens,
  openCrumb,
  openPalette,
  settingsPage,
  useAppStore,
  visible,
  getSection,
} from './harness';

let pushed = vi.fn(async () => ({ ok: true }));
let opened = vi.fn(async () => undefined);
let spawned = vi.fn(async () => undefined);
const openDiffHistory = async (): Promise<void> => {
  await openWorktreeMenu();
  await click(await screen.findByRole('menuitem', { name: /^Edit commits/ }));
};

const keepLedgerMount = (): void => {
  const state = useAppStore.getState();
  const sessionId = state.currentSessionId;
  if (sessionId === null) {
    return;
  }
  const ledger = (state.sessionProjectMounts[sessionId] ?? []).filter((mount) =>
    String(mount.mountId).endsWith('ledger-core'),
  );
  useAppStore.setState({
    sessionProjectMounts: { ...state.sessionProjectMounts, [sessionId]: ledger },
  });
};

const pressedKind = (name: string): Promise<void> =>
  waitFor(() => {
    expect(screen.getByRole('tab', { name }).getAttribute('aria-selected')).toBe('true');
  }, WAIT);

export const PALETTE_DESTINATION_ROWS: ReadonlyArray<Row> = [
  {
    name: 'rewrite history opens the Commits tab',
    covers: ['openRewriteHistory'],
    open: openDiffHistory,
    lands: branchTab('commits'),
  },
  {
    name: 'the Commits tab draws the branch and the header help, with no plan at rest',
    covers: ['openRewriteHistory'],
    open: openDiffHistory,
    lands: both(
      () => visible('list', 'Commits'),
      () => visible('button', 'Commits help'),
    ),
  },
  {
    name: 'previous versions drawer from the Commits tab',
    covers: ['openRewriteHistory'],
    open: async () => {
      await openDiffHistory();
      await clickButton(/^Previous versions/);
    },
    lands: () => visible('region', 'Previous versions'),
  },
  {
    name: 'Context tab from the Overview goal',
    covers: ['openContextDrawer', 'drawer:context'],
    open: async (ctx) => {
      useAppStore.getState().openContextDrawer({ sessionId: ctx.sessionId });
    },
    lands: async () => {
      await visible('region', 'Decision records');
      expect(screen.queryByRole('region', { name: 'Ask' })).toBeNull();
    },
  },
  {
    name: 'Ask as a detail panel, from its chord',
    covers: ['openAsk', 'drawer:ask'],
    open: async (ctx) => {
      useAppStore.getState().openAsk({ sessionId: ctx.sessionId });
    },
    lands: () => visible('region', 'Ask'),
  },
  {
    name: 'palette: Open Context',
    covers: ['navigate', 'palette:Open Context'],
    open: () => openPalette(/^Open Context/, 'open context'),
    lands: async (ctx) => {
      await waitFor(
        () => expect(useAppStore.getState().activeLens[ctx.sessionId] ?? null).toBe('context'),
        WAIT,
      );
    },
  },
  {
    name: 'palette: Refresh session',
    covers: ['resyncSession', 'palette:Refresh session'],
    open: () => openPalette(/^Refresh session/, 'refresh session'),
    lands: async () => {
      await clickButton('More session actions');
      expect(screen.queryByRole('menuitem', { name: /^Refresh session/ })).toBeNull();
    },
  },
  {
    name: 'palette: Board',
    covers: ['navigate', 'palette:Board'],
    open: () => openPalette(/^Board$/),
    lands: () => heading('Board'),
  },
  {
    name: 'palette: Board, found by its former name Sessions',
    covers: ['palette:Board'],
    open: () => openPalette(/^Board$/, 'Sessions'),
    lands: () => heading('Board'),
  },
  {
    name: 'palette: Chat',
    covers: ['openStudio', 'studio:chat', 'palette:Chat'],
    door: 'palette',
    open: () => openPalette(/^Chat$/),
    lands: () => studio('Chat'),
  },
  {
    name: 'palette: Terminal opens the dock, not a page',
    covers: ['palette:Terminal'],
    door: 'palette',
    open: () => openPalette(/^Terminal$/),
    lands: async () => {
      await screen.findByRole('button', { name: 'Open full page' }, WAIT);
      expect(useAppStore.getState().drawer?.kind).toBe('terminal');
      expect(useAppStore.getState().appStudio).toBeNull();
    },
  },
  {
    name: 'palette: Browser opens the dock, not a page',
    covers: ['palette:Browser'],
    door: 'palette',
    open: () => openPalette(/^Browser$/),
    lands: async () => {
      await waitFor(() => expect(useAppStore.getState().drawer?.kind).toBe('browser'), WAIT);
      expect(useAppStore.getState().appStudio).toBeNull();
    },
  },
  {
    name: 'palette: New terminal in this session',
    covers: ['palette:New terminal in this session'],
    door: 'palette',
    open: () => openPalette(/^New terminal in this session$/),
    lands: async () => {
      await screen.findByRole('button', { name: 'Open full page' }, WAIT);
      expect(useAppStore.getState().drawer?.kind).toBe('terminal');
      expect(useAppStore.getState().appStudio).toBeNull();
    },
  },
  {
    name: 'palette verb: Open in Terminal',
    covers: ['palette:Open in Terminal'],
    seed: 'pr',
    door: 'palette',
    open: async () => {
      await openPalette(/^Open in Terminal/);
      const [choice] = await screen.findAllByRole('option', { name: /ledger-core/ });
      if (choice === undefined) {
        throw new Error('The palette offers no worktree to open');
      }
      fireEvent.mouseDown(choice);
      await settle();
    },
    lands: async () => {
      await screen.findByRole('button', { name: 'Open full page' }, WAIT);
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
    covers: ['pushBranch', 'palette:Push the branch'],
    seed: 'pr',
    open: async () => {
      pushed = vi.fn(async () => ({ ok: true }));
      useAppStore.setState({ pushBranch: pushed } as never);
      keepLedgerMount();
      await openPalette(/^Push the branch/);
    },
    lands: () => waitFor(() => expect(pushed).toHaveBeenCalledTimes(1), WAIT),
  },
  {
    name: 'palette next step: Open a pull request',
    covers: ['navigate', 'palette:Open a pull request for hl/reconcile-settlement-export'],
    seed: 'pr',
    open: async () => {
      opened = vi.fn(async () => undefined);
      useAppStore.setState({ createPrForSession: opened } as never);
      await openPalette(/^Open a pull request for hl\/reconcile-settlement-export/);
    },
    lands: async () => {
      await waitFor(
        () => expect(getSection(/^Conversation/).getAttribute('aria-selected')).toBe('true'),
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
      keepLedgerMount();
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
    name: 'palette: Tasks',
    covers: ['openStudio', 'studio:inbox', 'palette:Tasks'],
    door: 'palette',
    open: () => openPalette(/^Tasks$/),
    lands: both(
      () => studio('Tasks'),
      () => heading(/^Tasks$/),
    ),
  },
  {
    name: 'palette: Workflows',
    covers: ['openStudio', 'studio:workflow', 'palette:Workflows'],
    door: 'palette',
    open: () => openPalette(/^Workflows$/),
    lands: both(
      () => studio('Workflows'),
      () => visible('button', 'New workflow'),
    ),
  },
  {
    name: 'palette: Workspace settings: Runs',
    covers: ['openSettings', 'scope:workspace', 'palette:Runs'],
    door: 'palette',
    open: () => openPalette(/^Workspace settings: Runs/, 'runs'),
    lands: () => heading(/^Runs$/),
  },
  {
    name: 'palette: Impact',
    covers: ['openStudio', 'studio:impact', 'palette:Impact'],
    door: 'palette',
    open: () => openPalette(/^Impact$/),
    lands: () => studio('Impact'),
  },
  {
    name: 'palette: Impact: Spend',
    covers: ['openStudio', 'studio:impact', 'palette:Impact: Spend'],
    door: 'palette',
    open: () => openPalette(/^Impact: Spend/, 'impact spend'),
    lands: both(
      () => studio('Impact'),
      () => heading('Spend'),
    ),
  },
  {
    name: "palette: What's new",
    covers: ['openStudio', 'studio:changelog', "palette:What's new"],
    door: 'palette',
    open: () => openPalette(/^What's new/),
    lands: both(
      () => studio("What's new"),
      () => heading(/^Goodboy \d/),
    ),
  },
  {
    name: 'palette: Notifications',
    covers: ['openStudio', 'studio:notifications', 'palette:Notifications'],
    door: 'palette',
    open: () => openPalette(/^Notifications/),
    lands: both(
      () => studio('Notifications'),
      () => heading('Notifications'),
    ),
  },
  {
    name: 'palette: Workspace settings',
    covers: ['openStudio', 'studio:settings', 'scope:workspace', 'palette:Workspace settings'],
    door: 'palette',
    open: () => openPalette(/^Workspace settings: Projects/, 'workspace settings folders'),
    lands: both(
      () => settingsPage(),
      () => visible('textbox', 'Workspace name'),
    ),
  },
  {
    name: 'palette: Settings',
    covers: ['openStudio', 'studio:settings', 'scope:home', 'palette:Settings'],
    door: 'palette',
    open: () => openPalette(/^Settings$/),
    lands: both(
      () => settingsPage(),
      () => visible('navigation', 'Settings scopes'),
    ),
  },
  {
    name: 'palette: Check for updates',
    covers: ['openStudio', 'studio:settings', 'settings:updates', 'palette:Check for updates'],
    door: 'palette',
    open: () => openPalette(/^Check for updates/),
    lands: both(
      () => settingsPage(),
      () => heading('Updates'),
    ),
  },
  {
    name: 'palette: New chat',
    covers: ['openStudio', 'studio:chat', 'palette:New chat'],
    door: 'palette',
    open: () => openPalette(/^New chat/),
    lands: () => studio('Chat'),
  },
  {
    name: 'palette: New session',
    covers: ['openSessionDraft', 'palette:New session'],
    open: () => openPalette(/^New session/),
    lands: () => heading('New session'),
  },
  {
    name: 'palette: New workflow session',
    covers: ['openSessionDraft', 'palette:New workflow session'],
    open: () => openPalette(/^New workflow session$/),
    lands: both(
      () => heading('New session'),
      () => pressedKind('The Lead plans it'),
    ),
  },
  {
    name: 'palette: New agent session',
    covers: ['openSessionDraft', 'palette:New agent session'],
    open: () => openPalette(/^New agent session$/),
    lands: both(
      () => heading('New session'),
      () => pressedKind('The Lead plans it'),
    ),
  },
  {
    name: 'sidebar: New opens the kickoff',
    covers: ['openSessionDraft', 'button:New'],
    open: () => clickButton(/^New session$/),
    lands: both(
      () => heading('New session'),
      () => visible('textbox', 'Goal'),
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
        expect((await screen.findAllByText(/^Untitled session$/, {}, WAIT)).length).toBeGreaterThan(
          0,
        ),
      async () => expect(await screen.findByTestId('session-tools')).toBeDefined(),
    ),
  },
  {
    name: 'palette: Connect a provider',
    covers: ['openStudio', 'studio:connections', 'palette:Connect a provider'],
    door: 'palette',
    open: () => openPalette(/^Connect a provider/),
    lands: () => studio('Connections'),
  },
  {
    name: 'palette: Pair an iPhone',
    covers: ['openStudio', 'studio:settings', 'settings:iphone', 'palette:Pair an iPhone'],
    door: 'palette',
    open: () => openPalette(/^Pair an iPhone/, 'iPhone'),
    lands: both(
      () => settingsPage(),
      () => heading('iPhone'),
    ),
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
    lands: () => heading('Keyboard shortcuts'),
  },
  {
    name: 'palette: Guide',
    covers: ['openStudio', 'studio:guide', 'palette:Guide'],
    door: 'palette',
    open: () => openPalette(/^Guide/),
    lands: () => studio('Guide'),
  },
  {
    name: 'palette verb: Rename',
    covers: ['palette:Rename'],
    open: () => openPalette(/^Rename$/),
    lands: () => visible('textbox', 'Session title'),
  },
  {
    name: 'palette verb: Start a run',
    covers: ['navigate', 'palette:Start a run'],
    open: () => openPalette(/^Start a run$/),
    lands: both(lens('workflows'), () => heading('Runs')),
  },
  {
    name: 'palette verb: Link work',
    covers: ['palette:Link work'],
    open: () => openPalette(/^Link work$/),
    lands: () => visible('dialog', 'Link work'),
  },
  {
    name: 'palette: Desk carries its key and switches the face of the session',
    covers: ['palette:Desk'],
    open: async () => {
      await clickButton(/^Search or run \(/);
      const input = await screen.findByRole('combobox', { name: /search/i });
      fireEvent.change(input, { target: { value: 'desk' } });
      await settle();
      const option = await screen.findByRole('option', { name: /^Desk/ });
      expect(option.textContent).toContain(shortcutGlyphs('session.desk'));
      fireEvent.mouseDown(option);
      await settle();
    },
    lands: async (ctx) => {
      await waitFor(() => expect(useAppStore.getState().sessionFace[ctx.sessionId]).toBe('desk'));
      await visible('complementary', 'Desk');
    },
  },
  {
    name: 'palette: Overview on the Desk switches the face back',
    covers: ['palette:Overview'],
    open: async (ctx) => {
      switchSessionFace({ sessionId: ctx.sessionId, face: 'desk' });
      await settle();
      await openPalette(/^Overview/, 'overview');
    },
    lands: async (ctx) =>
      waitFor(() => expect(useAppStore.getState().sessionFace[ctx.sessionId]).toBe('overview')),
  },
];
