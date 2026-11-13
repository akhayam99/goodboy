import { expect } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { seedPolicyScene } from '../../../app/components/MockScene/scenes/providerPolicySeed';
import type { ShortcutId } from '../../../shared/keyboard/registry';
import { openQuestionFor } from '../../../features/workspace/testing/sessionColumn';
import { STORAGE_KEYS } from '../../../shared/lib/storage-keys';
import { pressShortcut } from '../../helpers/pressKey';
import {
  type Ctx,
  type Row,
  WAIT,
  studio,
  both,
  click,
  clickButton,
  heading,
  settingsPage,
  settle,
  useAppStore,
  visible,
} from './harness';

const storedCollapse = (): string | null =>
  window.localStorage.getItem(STORAGE_KEYS.sessionSidebarCollapsed);

const hasRail = (): boolean => document.querySelector('[data-column-rail]') !== null;

const studioKind = (): string | null => useAppStore.getState().appStudio?.kind ?? null;

const collapse = async (): Promise<void> => {
  await clickButton(/^Hide sidebar/);
  await waitFor(() => expect(hasRail()).toBe(true), WAIT);
  expect(storedCollapse()).toBe('1');
};

const openFromRail = async (): Promise<void> => {
  await clickButton('Settings');
  await settingsPage();
  expect(hasRail()).toBe(true);
};

const goToClaude = async (): Promise<void> => {
  const nav = await screen.findByRole('navigation', { name: 'Settings scopes' });
  await click(within(nav).getAllByRole('button', { name: /^Providers/ })[0] as HTMLElement);
  const list = await screen.findByRole('list', { name: 'Providers settings' });
  await click(within(list).getByRole('button', { name: /^Claude/ }));
  await heading('Claude');
};

const escape = async (): Promise<void> => {
  await userEvent.setup().keyboard('{Escape}');
  await settle(12);
};

const pressKey = async (id: ShortcutId): Promise<void> => {
  const anchor = await screen.findByRole('button', { name: /^Search or run \(/ });
  anchor.focus();
  pressShortcut({ id });
  await settle();
};

const backToApp = async (): Promise<void> => {
  await click(screen.getByRole('button', { name: /^Back to app/ }));
  await settle(8);
};

const railAndSessionBack =
  (collapsed: '1' | '0' | null) =>
  async (ctx: Ctx): Promise<void> => {
    await waitFor(() => expect(studioKind()).toBeNull(), WAIT);
    await waitFor(() => expect(hasRail()).toBe(collapsed === '1'), WAIT);
    expect(document.querySelector('[data-studio-frame]')).toBeNull();
    expect(useAppStore.getState().currentSessionId).toBe(ctx.sessionId);
    expect((await screen.findByTestId('overview-title')).closest('h1')).not.toBeNull();
    expect(storedCollapse()).toBe(collapsed);
  };

const sessionKeyRow = ({
  id,
  prepare,
}: {
  readonly id: ShortcutId;
  readonly prepare?: (ctx: Ctx) => void;
}): Row => ({
  name: `settings frame: ${id} with Settings open on the rail closes it and keeps the rail`,
  covers: ['openSettings', `key:${id}`],
  open: async (ctx) => {
    await collapse();
    await openFromRail();
    prepare?.(ctx);
    await pressKey(id);
  },
  lands: async (ctx) => {
    await waitFor(() => expect(studioKind()).toBeNull(), WAIT);
    await waitFor(() => expect(hasRail()).toBe(true), WAIT);
    expect(useAppStore.getState().currentSessionId).not.toBe(ctx.sessionId);
    expect(storedCollapse()).toBe('1');
  },
});

export const SETTINGS_FRAME_ROWS: ReadonlyArray<Row> = [
  {
    name: 'settings frame: folded sidebar, session, Settings, Providers and Claude, then Back to app',
    covers: ['openSettings', 'scope:providers', 'settings:provider'],
    open: async () => {
      await collapse();
      await openFromRail();
      expect(screen.getByRole('button', { name: /^Back to app/ })).toBeDefined();
      await goToClaude();
      await backToApp();
    },
    lands: railAndSessionBack('1'),
  },
  {
    name: 'settings frame: folded sidebar, session, Settings, Providers and Claude, then Esc',
    covers: ['openSettings', 'scope:providers', 'settings:provider'],
    open: async () => {
      await collapse();
      await openFromRail();
      await goToClaude();
      await escape();
    },
    lands: railAndSessionBack('1'),
  },
  {
    name: 'settings frame: pinned sidebar, Settings, Back to app returns the column and the page',
    covers: ['openSettings', 'scope:home'],
    open: async () => {
      await clickButton('Settings');
      await settingsPage();
      expect(hasRail()).toBe(false);
      await backToApp();
    },
    lands: async (ctx) => {
      await railAndSessionBack(null)(ctx);
      expect(document.querySelector('[data-side-column] [data-column-layer="nav"]')).not.toBeNull();
    },
  },
  {
    name: 'settings frame: pinned sidebar, Settings, Esc returns the column and the page',
    covers: ['openSettings', 'scope:home'],
    open: async () => {
      await clickButton('Settings');
      await settingsPage();
      await escape();
    },
    lands: railAndSessionBack(null),
  },
  {
    name: 'settings frame: Cmd+, from the rail opens the page beside the rail and Back to app keeps it',
    covers: ['openSettings', 'scope:home', 'key:settings.open'],
    open: async () => {
      await collapse();
      await pressKey('settings.open');
      await settingsPage();
      expect(hasRail()).toBe(true);
      await backToApp();
    },
    lands: railAndSessionBack('1'),
  },
  {
    name: 'settings frame: Cmd+B unfolds and folds the sidebar while Settings stays open',
    covers: ['openSettings', 'key:column.toggle'],
    open: async () => {
      await collapse();
      await openFromRail();
      await pressKey('column.toggle');
      await waitFor(() => expect(hasRail()).toBe(false), WAIT);
      expect(storedCollapse()).toBe('0');
      expect(studioKind()).toBe('settings');
      expect(
        screen.getByRole('button', { name: /^Hide sidebar/ }).getAttribute('aria-pressed'),
      ).toBe('true');
      await pressKey('column.toggle');
      await waitFor(() => expect(hasRail()).toBe(true), WAIT);
      expect(storedCollapse()).toBe('1');
      await settingsPage();
      await backToApp();
    },
    lands: railAndSessionBack('1'),
  },
  {
    name: 'settings frame: the sidebar toggle folds the column while Settings stays open',
    covers: ['openSettings', 'key:column.toggle'],
    open: async () => {
      await clickButton('Settings');
      await settingsPage();
      await clickButton(/^Hide sidebar/);
      await waitFor(() => expect(hasRail()).toBe(true), WAIT);
      expect(storedCollapse()).toBe('1');
      expect(
        screen.getByRole('button', { name: /^Show sidebar/ }).getAttribute('aria-pressed'),
      ).toBe('false');
      await settingsPage();
      await clickButton(/^Show sidebar/);
      await waitFor(() => expect(hasRail()).toBe(false), WAIT);
      await backToApp();
    },
    lands: railAndSessionBack('0'),
  },
  {
    name: 'settings frame: the sessions peek stays on the folded rail while Settings is open',
    covers: ['openSettings'],
    open: async () => {
      await collapse();
      expect(screen.queryByTestId('sidebar-peek-edge')).not.toBeNull();
      await openFromRail();
      expect(screen.queryByTestId('sidebar-peek-edge')).not.toBeNull();
      await backToApp();
    },
    lands: async (ctx) => {
      await railAndSessionBack('1')(ctx);
      expect(screen.queryByTestId('sidebar-peek-edge')).not.toBeNull();
    },
  },
  {
    name: 'settings frame: a page with its band, no crumb and its own scopes rail beside the live column',
    covers: ['openSettings', 'scope:home'],
    open: async () => {
      await clickButton('Settings');
      await settingsPage();
    },
    lands: async () => {
      await heading('Appearance');
      expect(document.querySelector('[data-studio-band]')).not.toBeNull();
      expect(document.querySelector('[data-studio-rail="page"]')).not.toBeNull();
      expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull();
      const rail = screen.getByRole('complementary', { name: 'Settings scopes' });
      expect(within(rail).getByRole('searchbox', { name: 'Search settings' })).toBeDefined();
      const detail = document.querySelector('[data-settings-detail]');
      expect(detail).not.toBeNull();
      expect(within(detail as HTMLElement).queryByRole('navigation')).toBeNull();
      expect(screen.getAllByRole('navigation', { name: 'Settings scopes' })).toHaveLength(1);
      const column = screen.getByRole('navigation', { name: 'Sidebar' });
      expect(column.hasAttribute('inert')).toBe(false);
      expect(within(column).getByRole('button', { name: /^Tasks/ })).toBeDefined();
    },
  },
  {
    name: 'settings frame: a column row leaves Settings in one click',
    covers: ['openSettings', 'door:inbox'],
    open: async () => {
      await clickButton('Settings');
      await settingsPage();
      const column = screen.getByRole('navigation', { name: 'Sidebar' });
      await click(within(column).getByRole('button', { name: /^Tasks/ }));
    },
    lands: async () => {
      await waitFor(() => expect(studioKind()).toBe('inbox'), WAIT);
      expect(screen.queryByRole('complementary', { name: 'Settings scopes' })).toBeNull();
    },
  },
  sessionKeyRow({ id: 'session.prev' }),
  {
    name: 'settings frame: Control Tab with Settings open on the rail closes it and opens the chosen session',
    covers: ['openSettings', 'key:session.switcher'],
    open: async (ctx) => {
      await collapse();
      await openFromRail();
      useAppStore.getState().markSessionOpened({ sessionId: ctx.sessionId });
      await pressKey('session.switcher');
      await visible('listbox', 'Recent sessions');
      fireEvent.keyUp(window, { key: 'Control', code: 'ControlLeft' });
      await settle();
    },
    lands: async (ctx) => {
      await waitFor(() => expect(studioKind()).toBeNull(), WAIT);
      await waitFor(() => expect(hasRail()).toBe(true), WAIT);
      expect(useAppStore.getState().currentSessionId).not.toBe(ctx.sessionId);
      expect(storedCollapse()).toBe('1');
    },
  },
  {
    name: 'settings frame: the next session that needs you closes Settings and keeps the rail',
    covers: ['openSettings', 'key:session.nextNeedsYou'],
    open: async (ctx) => {
      const waiting = useAppStore
        .getState()
        .sessions.find((session) => session.id !== ctx.sessionId);
      if (waiting === undefined) {
        throw new Error('the board seed has no second session');
      }
      await collapse();
      await openFromRail();
      useAppStore.setState({
        sessionOpenQuestions: {
          [waiting.id]: [openQuestionFor({ sessionId: waiting.id as SessionId })],
        },
      });
      await pressKey('session.nextNeedsYou');
    },
    lands: async (ctx) => {
      await waitFor(() => expect(studioKind()).toBeNull(), WAIT);
      expect(useAppStore.getState().currentSessionId).not.toBe(ctx.sessionId);
      expect(hasRail()).toBe(true);
    },
  },
  {
    name: 'settings frame: a provider about to run out shows a dot in the nav and the notice on its page',
    covers: ['openSettings', 'scope:providers', 'settings:provider'],
    open: async () => {
      seedPolicyScene({ workspaceId: useAppStore.getState().currentWorkspaceId as WorkspaceId });
      await clickButton('Settings');
      await settingsPage();
      await goToClaude();
    },
    lands: async () => {
      const list = screen.getByRole('list', { name: 'Providers settings' });
      const claude = within(list).getByRole('button', { name: /^Claude/ });
      expect(claude.textContent).toBe('Claude');
      expect(within(claude).getByRole('img', { name: 'Claude is about to run out' })).toBeDefined();
      expect(
        within(within(list).getByRole('button', { name: /^Codex/ })).getByRole('img', {
          name: 'Codex is out',
        }),
      ).toBeDefined();
      const detail = document.querySelector('[data-settings-detail]') as HTMLElement;
      const body = detail.querySelector('[data-slot="pane-body"]') as HTMLElement;
      expect(body.firstElementChild?.textContent).toContain('Claude is about to run out.');
      expect(
        Array.from(list.querySelectorAll('button')).every(
          (row) => (row.textContent ?? '').trim().split('\n').length === 1,
        ),
      ).toBe(true);
    },
  },
];
