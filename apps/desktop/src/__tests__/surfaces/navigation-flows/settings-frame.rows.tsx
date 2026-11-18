import { expect } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { seedPolicyScene } from '../../../app/components/MockScene/scenes/providerPolicySeed';
import type { ShortcutId } from '../../../shared/keyboard/registry';
import { openQuestionFor } from '../../../features/workspace/testing/sessionColumn';
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
  searchSettingsForConnections,
  settingsPage,
  settle,
  useAppStore,
  visible,
} from './harness';

const hasRail = (): boolean => document.querySelector('[data-shell-rail]') !== null;

const studioKind = (): string | null => useAppStore.getState().appStudio?.kind ?? null;

const openFromRail = async (): Promise<void> => {
  await clickButton('Settings');
  await settingsPage();
  expect(hasRail()).toBe(true);
};

const goToModels = async (): Promise<void> => {
  const nav = await screen.findByRole('navigation', { name: 'Settings scopes' });
  await click(within(nav).getByRole('button', { name: 'Models' }));
  await heading('Models');
};

const goToClaude = async (): Promise<void> => {
  const nav = await screen.findByRole('navigation', { name: 'Settings scopes' });
  expect(within(nav).queryByRole('button', { name: /Connections/ })).toBeNull();
  await searchSettingsForConnections();
  await heading('Connections');
  await click(await screen.findByRole('button', { name: /^Claude, / }));
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

const railAndSessionBack = async (ctx: Ctx): Promise<void> => {
  await waitFor(() => expect(studioKind()).toBeNull(), WAIT);
  expect(hasRail()).toBe(true);
  expect(document.querySelector('[data-studio-frame]')).toBeNull();
  expect(useAppStore.getState().currentSessionId).toBe(ctx.sessionId);
  expect((await screen.findByTestId('overview-title')).closest('h1')).not.toBeNull();
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
    await openFromRail();
    prepare?.(ctx);
    await pressKey(id);
  },
  lands: async (ctx) => {
    await waitFor(() => expect(studioKind()).toBeNull(), WAIT);
    expect(hasRail()).toBe(true);
    expect(useAppStore.getState().currentSessionId).not.toBe(ctx.sessionId);
  },
});

export const SETTINGS_FRAME_ROWS: ReadonlyArray<Row> = [
  {
    name: 'settings frame: session, Settings, Models, then Back to app',
    covers: ['openSettings', 'scope:workspace', 'settings:models'],
    open: async () => {
      await openFromRail();
      expect(screen.getByRole('button', { name: /^Back to app/ })).toBeDefined();
      await goToModels();
      await backToApp();
    },
    lands: railAndSessionBack,
  },
  {
    name: 'settings frame: session, Settings, Models, then Esc',
    covers: ['openSettings', 'scope:workspace', 'settings:models'],
    open: async () => {
      await openFromRail();
      await goToModels();
      await escape();
    },
    lands: railAndSessionBack,
  },
  {
    name: 'settings frame: Settings, Back to app returns the rail and the page',
    covers: ['openSettings', 'scope:home'],
    open: async () => {
      await clickButton('Settings');
      await settingsPage();
      await backToApp();
    },
    lands: railAndSessionBack,
  },
  {
    name: 'settings frame: Settings, Esc returns the rail and the page',
    covers: ['openSettings', 'scope:home'],
    open: async () => {
      await clickButton('Settings');
      await settingsPage();
      await escape();
    },
    lands: railAndSessionBack,
  },
  {
    name: 'settings frame: Cmd+, from the rail opens the page beside the rail and Back to app keeps it',
    covers: ['openSettings', 'scope:home', 'key:settings.open'],
    open: async () => {
      await pressKey('settings.open');
      await settingsPage();
      expect(hasRail()).toBe(true);
      await backToApp();
    },
    lands: railAndSessionBack,
  },
  {
    name: 'settings frame: a page with its band, no crumb and its own scopes rail beside the live places rail',
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
      const places = screen.getByRole('navigation', { name: 'Places' });
      expect(places.closest('[inert]')).toBeNull();
      within(places).getByRole('button', { name: /^Tasks/ });
    },
  },
  {
    name: 'settings frame: a place on the rail leaves Settings in one click',
    covers: ['openSettings', 'door:inbox'],
    open: async () => {
      await clickButton('Settings');
      await settingsPage();
      const places = screen.getByRole('navigation', { name: 'Places' });
      await click(within(places).getByRole('button', { name: /^Tasks/ }));
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
      await openFromRail();
      useAppStore.getState().markSessionOpened({ sessionId: ctx.sessionId });
      await pressKey('session.switcher');
      await visible('listbox', 'Recent sessions');
      fireEvent.keyUp(window, { key: 'Control', code: 'ControlLeft' });
      await settle();
    },
    lands: async (ctx) => {
      await waitFor(() => expect(studioKind()).toBeNull(), WAIT);
      expect(hasRail()).toBe(true);
      expect(useAppStore.getState().currentSessionId).not.toBe(ctx.sessionId);
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
    name: 'settings frame: Search settings leads to a provider about to run out, with the notice on its page',
    covers: ['openSettings', 'studio:connections'],
    door: 'visible',
    open: async () => {
      seedPolicyScene({ workspaceId: useAppStore.getState().currentWorkspaceId as WorkspaceId });
      await clickButton('Settings');
      await settingsPage();
      await goToClaude();
    },
    lands: async () => {
      expect(screen.queryByRole('list', { name: 'Providers settings' })).toBeNull();
      expect(await screen.findByText('Claude is about to run out.')).toBeDefined();
    },
  },
];
