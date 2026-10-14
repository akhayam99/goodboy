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
const WORKTREE_PATH = '~/code/harborline/payments-api-idempotency';

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

  it('opens the session terminal in a right drawer with a tab strip and icon buttons', async () => {
    renderScene({ name: 'terminal-drawer-session' });
    await settle();

    const drawer = screen.getByRole('region', { name: 'payments-api' });
    expect(within(drawer).getByTestId('worktree-chip').textContent).toBe(
      'payments-api-idempotency',
    );
    expect(within(drawer).getByRole('button', { name: 'Open on Terminal page' })).toBeDefined();
    expect(within(drawer).getByRole('button', { name: 'Close' })).toBeDefined();
    expect(within(drawer).getByRole('button', { name: 'New tab on payments-api' })).toBeDefined();
    const tabs = within(within(drawer).getByRole('tablist')).getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['shell', 'dev server']);
    expect(within(drawer).getByTestId('terminal-panel').getAttribute('data-terminal')).toMatch(
      /::t1$/,
    );
  });

  it('lets the folder chip shrink before the title and keeps the buttons apart', async () => {
    renderScene({ name: 'terminal-drawer-session' });
    await settle();

    const drawer = screen.getByRole('region', { name: 'payments-api' });
    const chip = within(drawer).getByTestId('worktree-chip');
    expect(chip.textContent).toBe('payments-api-idempotency');
    const header = drawer.querySelector('[data-drawer-header-row]');
    expect(
      header?.contains(within(drawer).getByRole('button', { name: 'Open on Terminal page' })),
    ).toBe(true);
    expect(within(drawer).queryByText('Open on Terminal page')).toBeNull();
  });

  it('switches tabs inside the drawer without leaving the worktree', async () => {
    renderScene({ name: 'terminal-drawer-session' });
    await settle();
    const drawer = screen.getByRole('region', { name: 'payments-api' });

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
    expect(tabs.at(-1)?.cwd).toBe('~/code/harborline/payments-api-idempotency');
    expect(tabs.at(-1)?.title).toBe('shell 2');
    const drawer = screen.getByRole('region', { name: 'payments-api' });
    expect(within(drawer).getAllByRole('tab')).toHaveLength(3);
  });

  it('keeps the drawer open while another tab of the worktree remains', async () => {
    renderScene({ name: 'terminal-drawer-session' });
    await settle();
    const drawer = screen.getByRole('region', { name: 'payments-api' });

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
      within(screen.getByRole('region', { name: 'payments-api' })).getByRole('button', {
        name: 'Close',
      }),
    );

    expect(store.getState().drawer).toBeNull();
    expect(Object.values(store.getState().terminalTabs).flat()).toHaveLength(before);
  });

  it('moves the same worktree and tab to the Terminal page from the drawer', async () => {
    renderScene({ name: 'terminal-drawer-session' });
    await settle();
    const drawer = screen.getByRole('region', { name: 'payments-api' });
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

    const groups = screen.getAllByRole('region').map((group) => group.getAttribute('aria-label'));
    expect(groups).toEqual(['Stop retried webhooks posting a second credit', 'Workspace folder']);
    const session = screen.getByRole('region', {
      name: 'Stop retried webhooks posting a second credit',
    });
    const rows = within(session).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(within(rows[0] ?? document.body).getByLabelText('2 terminals')).toBeDefined();
    expect(within(rows[1] ?? document.body).getByLabelText('1 terminal')).toBeDefined();
  });
});
