// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('../../../../../shared/components/GenericTerminalPanel/LazyGenericTerminalPanel', () => ({
  LazyGenericTerminalPanel: ({ terminalId }: LazyGenericTerminalPanelParams) => (
    <div data-testid="terminal-panel" data-terminal={terminalId} />
  ),
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { MOCK_SCENES } from '../..';
import { U25_B_TERMINAL_DRAWER_SCENES } from './b-terminal-drawer';

type LazyGenericTerminalPanelParams = {
  readonly terminalId: string;
};

const SESSION_ID = 'mock-run-session-webhooks';
const WORKTREE_PATH = '~/code/harborline/payments-api/.goodboy/worktrees/gb-7k2q9x';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
});

const settle = (): Promise<void> =>
  act(() => new Promise<void>((resolve) => window.setTimeout(resolve, 150)));

type RenderSceneParams = {
  readonly name: keyof typeof U25_B_TERMINAL_DRAWER_SCENES;
};

const renderScene = ({ name }: RenderSceneParams) => {
  const Scene = U25_B_TERMINAL_DRAWER_SCENES[name];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the terminal drawer scenes', () => {
  it('registers both scenes', () => {
    for (const [id, scene] of Object.entries(U25_B_TERMINAL_DRAWER_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(scene);
    }
  });

  it('swaps the scope from the picker and keeps the shells of the old one running', async () => {
    renderScene({ name: 'terminal-drawer-session' });
    await settle();
    const before = store.getState().terminalTabs[SESSION_ID] ?? [];

    fireEvent.click(screen.getByRole('combobox', { name: 'Terminal folder' }));
    fireEvent.click(await screen.findByRole('option', { name: /notify-relay/ }));
    await settle();

    const drawer = store.getState().drawer;
    expect(drawer?.kind).toBe('terminal');
    const after = store.getState().terminalTabs[SESSION_ID] ?? [];
    expect(after.map((tab) => tab.id)).toEqual(before.map((tab) => tab.id));
    expect(drawer?.kind === 'terminal' ? drawer.payload.terminalId : null).toMatch(/::t2$/);
    expect(screen.getByRole('combobox', { name: 'Terminal folder' }).textContent).toBe(
      'notify-relay · hl/surface-retry-state',
    );
  });

  it('opens the session terminal in a right drawer with a tab strip and icon buttons', async () => {
    renderScene({ name: 'terminal-drawer-session' });
    await settle();

    const drawer = screen.getByRole('region', { name: 'Terminal' });
    expect(within(drawer).queryByTestId('worktree-chip')).toBeNull();
    expect(within(drawer).getByRole('combobox', { name: 'Terminal folder' }).textContent).toBe(
      'payments-api · hl/fix-webhook-idempotency',
    );
    expect(within(drawer).getByRole('heading', { name: 'Terminal' })).toBeDefined();
    expect(within(drawer).queryByRole('combobox', { name: 'New terminal in' })).toBeNull();
    expect(within(drawer).getByRole('button', { name: 'Open on Terminal page' })).toBeDefined();
    expect(within(drawer).getByRole('button', { name: 'Close' })).toBeDefined();
    expect(within(drawer).getByRole('button', { name: 'New tab on payments-api' })).toBeDefined();
    const tabs = within(drawer).getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['shell', 'dev server']);
    expect(within(drawer).getByTestId('terminal-panel').getAttribute('data-terminal')).toMatch(
      /::t1$/,
    );
  });

  it('names the scope in the header, never the worktree folder hash', async () => {
    renderScene({ name: 'terminal-drawer-session' });
    await settle();

    const drawer = screen.getByRole('region', { name: 'Terminal' });
    const picker = within(drawer).getByRole('combobox', { name: 'Terminal folder' });
    expect(picker.textContent).toBe('payments-api · hl/fix-webhook-idempotency');
    expect(picker.textContent).not.toContain('gb-7k2q9x');
    const header = drawer.querySelector('[data-drawer-header-row]');
    expect(
      header?.contains(within(drawer).getByRole('button', { name: 'Open on Terminal page' })),
    ).toBe(true);
    expect(within(drawer).queryByText('Open on Terminal page')).toBeNull();
  });

  it('switches tabs inside the drawer without leaving the worktree', async () => {
    renderScene({ name: 'terminal-drawer-session' });
    await settle();
    const drawer = screen.getByRole('region', { name: 'Terminal' });

    fireEvent.click(within(drawer).getByRole('tab', { name: 'dev server' }));
    await settle();

    expect(within(drawer).getByTestId('terminal-panel').getAttribute('data-terminal')).toMatch(
      /::t3$/,
    );
    expect(store.getState().drawer?.kind).toBe('terminal');
  });

  it('adds a tab on the same worktree from the drawer plus button', async () => {
    renderScene({ name: 'terminal-drawer-session' });
    await settle();
    const before = (store.getState().terminalTabs[SESSION_ID] ?? []).length;

    fireEvent.click(screen.getByRole('button', { name: 'New tab on payments-api' }));
    await settle();

    const tabs = store.getState().terminalTabs[SESSION_ID] ?? [];
    expect(tabs).toHaveLength(before + 1);
    expect(tabs.at(-1)?.cwd).toBe('~/code/harborline/payments-api/.goodboy/worktrees/gb-7k2q9x');
    expect(tabs.at(-1)?.title).toBe('shell 2');
    const drawer = screen.getByRole('region', { name: 'Terminal' });
    expect(within(drawer).getAllByRole('tab')).toHaveLength(3);
  });

  it('keeps the drawer open while another tab of the worktree remains', async () => {
    renderScene({ name: 'terminal-drawer-session' });
    await settle();
    const drawer = screen.getByRole('region', { name: 'Terminal' });

    fireEvent.click(within(drawer).getByRole('button', { name: 'Close dev server' }));
    await settle();

    expect(store.getState().drawer?.kind).toBe('terminal');
    expect(within(drawer).getAllByRole('tab')).toHaveLength(1);
  });

  it('keeps the tab in the list when the drawer closes', async () => {
    renderScene({ name: 'terminal-drawer-session' });
    await settle();
    const before = Object.values(store.getState().terminalTabs).flat().length;

    fireEvent.click(
      within(screen.getByRole('region', { name: 'Terminal' })).getByRole('button', {
        name: 'Close',
      }),
    );

    expect(store.getState().drawer).toBeNull();
    expect(Object.values(store.getState().terminalTabs).flat()).toHaveLength(before);
  });

  it('moves the same worktree and tab to the Terminal page from the drawer', async () => {
    renderScene({ name: 'terminal-drawer-session' });
    await settle();
    const drawer = screen.getByRole('region', { name: 'Terminal' });
    fireEvent.click(within(drawer).getByRole('tab', { name: 'dev server' }));
    await settle();

    fireEvent.click(screen.getByRole('button', { name: 'Open on Terminal page' }));

    expect(store.getState().drawer).toBeNull();
    const studio = store.getState().appStudio;
    expect(studio?.kind).toBe('terminal');
    expect(studio?.kind === 'terminal' ? studio.terminalId : null).toBe(`${SESSION_ID}::t3`);
    expect(studio?.kind === 'terminal' ? studio.worktree : null).toBe(
      `${SESSION_ID}#m:mock-run-mount-payments`,
    );
    expect(studio?.kind === 'terminal' ? studio.sessionId : null).toBe(SESSION_ID);
  });

  it('closes the drawer only when the last terminal of its worktree is gone', async () => {
    renderScene({ name: 'terminal-drawer-session' });
    await settle();
    const tabs = store.getState().terminalTabs[SESSION_ID] ?? [];
    const onWorktree = tabs.filter((tab) => tab.cwd === WORKTREE_PATH);

    act(() => {
      for (const tab of onWorktree) {
        store.getState().closeTerminalTab({ owner: tab.owner, tabId: tab.id });
      }
    });

    expect(store.getState().drawer).toBeNull();
    expect(store.getState().terminalTabs[SESSION_ID]).toHaveLength(1);
  });

  it('lists the session worktrees on the Terminal page under a group named after the session', async () => {
    renderScene({ name: 'terminal-drawer-page' });
    await settle();

    const terminals = screen.getByRole('list', { name: 'Terminals' });
    const headings = within(terminals).getAllByRole('heading', { level: 3 });
    expect(headings.map((heading) => heading.textContent)).toEqual([
      'Stop retried webhooks posting a second credit',
      'Workspace folder',
    ]);
    const session = within(terminals).getByRole('list', {
      name: 'Stop retried webhooks posting a second credit',
    });
    expect(within(session).getAllByRole('listitem')).toHaveLength(2);
    expect(headings[0]?.closest('li')?.querySelector('[data-list-grid-count]')?.textContent).toBe(
      '2',
    );
  });
});
