// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('../../../../../shared/components/GenericTerminalPanel/LazyGenericTerminalPanel', () => ({
  LazyGenericTerminalPanel: ({ terminalId }: { readonly terminalId: string }) => (
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
import { U24_TERMINAL_STUDIO_SCENES } from './terminal-studio';

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

const renderScene = (name: keyof typeof U24_TERMINAL_STUDIO_SCENES) => {
  const Scene = U24_TERMINAL_STUDIO_SCENES[name];
  return render(<Scene />);
};

const settle = (): Promise<void> =>
  act(() => new Promise<void>((resolve) => window.setTimeout(resolve, 150)));

const PAYMENTS_SESSION = 'Round settlement totals to minor units';
const NOTIFY_SESSION = 'Back off failed notification retries';
const PAYMENTS_TREE = '/mock/harborline/payments-api/.goodboy/worktrees/gb-7k2q9x';
const LEDGER_TREE = '/mock/harborline/ledger-core/.goodboy/worktrees/gb-4m8d1c';
const NOTIFY_TREE = '/mock/harborline/notify-relay/.goodboy/worktrees/gb-2p6w0z';

const groupNamed = (name: string): HTMLElement => screen.getByRole('region', { name });

type RowParams = {
  readonly session: string;
  readonly project: string;
};

const worktreeRow = ({ session, project }: RowParams): HTMLElement => {
  const row = within(groupNamed(session)).getByText(project).closest('li');
  if (row === null) {
    throw new Error(`no row for ${project}`);
  }
  return row;
};

const selectWorktree = async ({ session, project }: RowParams): Promise<void> => {
  fireEvent.click(within(worktreeRow({ session, project })).getByRole('button'));
  await settle();
};

const tablist = (project: string): HTMLElement =>
  screen.getByRole('tablist', { name: `Terminals on ${project}` });

describe('the terminal studio scenes', () => {
  it('lists one group per session, then the workspace folder', async () => {
    renderScene('terminal-studio');
    await settle();

    const groups = screen.getAllByRole('region').map((group) => group.getAttribute('aria-label'));
    expect(groups).toEqual([PAYMENTS_SESSION, NOTIFY_SESSION, 'Workspace folder']);
  });

  it('draws one row per worktree with its terminal count', async () => {
    renderScene('terminal-studio');
    await settle();

    expect(within(groupNamed(PAYMENTS_SESSION)).getAllByRole('listitem')).toHaveLength(2);
    const payments = worktreeRow({ session: PAYMENTS_SESSION, project: 'payments-api' });
    expect(within(payments).getByLabelText('2 terminals')).toBeDefined();
    const ledger = worktreeRow({ session: PAYMENTS_SESSION, project: 'ledger-core' });
    expect(within(ledger).getByLabelText('1 terminal')).toBeDefined();
    const notify = worktreeRow({ session: NOTIFY_SESSION, project: 'notify-relay' });
    expect(within(notify).getByLabelText('1 terminal')).toBeDefined();
  });

  it('shows the linked task of the session in its group head', async () => {
    renderScene('terminal-studio');
    await settle();

    const facts = within(groupNamed(PAYMENTS_SESSION)).getByLabelText('Linked work and changes');
    expect(facts.textContent).toContain('HBL-412');
  });

  it('shows the terminals of the selected worktree as tabs, never as rail rows', async () => {
    renderScene('terminal-studio');
    await settle();

    const tabs = within(tablist('payments-api')).getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['dev server', 'shell']);
    expect(screen.queryByText(/^Terminal \d+$/)).toBeNull();
  });

  it('switches the tab strip and shows the failure when an exited worktree is selected', async () => {
    renderScene('terminal-studio');
    await settle();

    await selectWorktree({ session: PAYMENTS_SESSION, project: 'ledger-core' });

    const tabs = within(tablist('ledger-core')).getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['shell']);
    expect(screen.getByText('failed')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Restart shell' })).toBeDefined();
  });

  it('adds a tab to the selected worktree from the plus and selects it', async () => {
    renderScene('terminal-studio');
    await settle();

    fireEvent.click(screen.getByRole('button', { name: 'New tab on payments-api' }));
    await settle();

    const added = (store.getState().terminalTabs['mock-u24-session-ledger'] ?? []).at(-1);
    expect(added?.cwd).toBe(PAYMENTS_TREE);
    expect(added?.title).toBe('shell 2');
    const strip = within(tablist('payments-api')).getAllByRole('tab');
    expect(strip).toHaveLength(3);
    expect(strip.at(-1)?.getAttribute('aria-selected')).toBe('true');
  });

  it('opens a workspace terminal from the New terminal button when the workspace is selected', async () => {
    renderScene('terminal-studio');
    await settle();

    fireEvent.click(within(groupNamed('Workspace folder')).getByRole('button'));
    await settle();
    const rail = screen.getByRole('complementary', { name: 'Terminals' });
    fireEvent.click(within(rail).getByRole('button', { name: 'New terminal' }));
    await settle();

    const tabs = store.getState().terminalTabs['ws:mock-u24-workspace-harborline'] ?? [];
    expect(tabs).toHaveLength(2);
    expect(tabs.at(-1)?.cwd).toBe('/mock/harborline');
  });

  it('closes an idle tab at once, without a confirm', async () => {
    renderScene('terminal-studio');
    await settle();

    fireEvent.click(within(tablist('payments-api')).getByRole('button', { name: 'Close shell' }));
    await settle();

    expect(screen.queryByRole('dialog')).toBeNull();
    const titles = (store.getState().terminalTabs['mock-u24-session-ledger'] ?? []).map(
      (tab) => tab.title,
    );
    expect(titles).toEqual(['dev server', 'shell']);
  });

  it('asks before closing a busy tab and Keep leaves it running', async () => {
    renderScene('terminal-studio');
    await settle();

    fireEvent.click(screen.getByRole('button', { name: 'Close dev server' }));

    expect(await screen.findByText('pnpm dev is running. Close it?')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }));
    await settle();
    expect(screen.queryByText('pnpm dev is running. Close it?')).toBeNull();
    expect(store.getState().terminalTabs['mock-u24-session-ledger']).toHaveLength(3);
  });

  it('closes the busy tab once Close is confirmed', async () => {
    renderScene('terminal-studio');
    await settle();

    fireEvent.click(screen.getByRole('button', { name: 'Close dev server' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Close' }));
    await settle();

    const titles = (store.getState().terminalTabs['mock-u24-session-ledger'] ?? []).map(
      (tab) => tab.title,
    );
    expect(titles).toEqual(['shell', 'shell']);
  });

  it('renames a tab by double click and Enter, and Escape cancels', async () => {
    renderScene('terminal-studio');
    await settle();

    fireEvent.doubleClick(screen.getByRole('tab', { name: 'dev server' }));
    const input = screen.getByRole('textbox', { name: 'Rename dev server' });
    fireEvent.change(input, { target: { value: 'api server' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await settle();

    expect(screen.getByRole('tab', { name: 'api server' })).toBeDefined();

    fireEvent.doubleClick(screen.getByRole('tab', { name: 'api server' }));
    const again = screen.getByRole('textbox', { name: 'Rename api server' });
    fireEvent.change(again, { target: { value: 'discarded' } });
    fireEvent.keyDown(again, { key: 'Escape' });

    expect(screen.getByRole('tab', { name: 'api server' })).toBeDefined();
    expect(screen.queryByText('discarded')).toBeNull();
  });

  it('restarts an exited tab into a fresh terminal at the same folder', async () => {
    renderScene('terminal-studio');
    await settle();
    await selectWorktree({ session: PAYMENTS_SESSION, project: 'ledger-core' });

    fireEvent.click(screen.getByRole('button', { name: 'Restart shell' }));
    await settle();

    const ledger = (store.getState().terminalTabs['mock-u24-session-ledger'] ?? []).filter(
      (tab) => tab.cwd === LEDGER_TREE,
    );
    expect(ledger.map((tab) => tab.status)).toEqual(['running']);
  });

  it('shows the cwd of the selected terminal in the location row', async () => {
    renderScene('terminal-studio');
    await settle();

    expect(screen.getAllByText(/gb-7k2q9x/).length).toBeGreaterThan(0);
  });

  it('offers Open session in the header of a session worktree', async () => {
    renderScene('terminal-studio');
    await settle();

    expect(screen.getAllByRole('button', { name: /^Open session/ }).length).toBeGreaterThan(0);
  });

  it('groups the picker by session, with the workspace folder first', async () => {
    renderScene('terminal-studio-newmenu');
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'New terminal in' }));

    const menu = await screen.findByRole('menu', { name: 'New terminal in' });
    const clusters = within(menu)
      .getAllByRole('group')
      .map((group) => group.getAttribute('aria-label'));
    expect(clusters).toEqual(['Workspace folder', PAYMENTS_SESSION, NOTIFY_SESSION]);
    expect(within(menu).getAllByRole('menuitem', { name: /^Open project/ })).toHaveLength(3);
    expect(within(menu).queryByText('Main checkout')).toBeNull();
  });

  it('opens a terminal in a worktree of another session as a tab and focuses it', async () => {
    renderScene('terminal-studio-newmenu');
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'New terminal in' }));
    const menu = await screen.findByRole('menu', { name: 'New terminal in' });
    const notify = within(menu).getByRole('group', { name: NOTIFY_SESSION });

    fireEvent.click(within(notify).getAllByRole('menuitem')[0] ?? document.body);
    await settle();

    const tabs = store.getState().terminalTabs['mock-u24-session-notify'] ?? [];
    expect(tabs).toHaveLength(2);
    expect(tabs.at(-1)?.cwd).toBe(NOTIFY_TREE);
    expect(store.getState().appStudio).toMatchObject({
      kind: 'terminal',
      terminalId: tabs.at(-1)?.id,
      sessionId: 'mock-u24-session-notify',
    });
  });

  it('offers cd only while the shell is idle', async () => {
    renderScene('terminal-studio');
    await settle();
    expect(
      screen.queryByRole('combobox', { name: 'Change directory in this terminal' }),
    ).toBeNull();

    fireEvent.click(within(groupNamed('Workspace folder')).getByRole('button'));
    await settle();

    expect(
      screen.getByRole('combobox', { name: 'Change directory in this terminal' }),
    ).toBeDefined();
  });

  it('shows the empty state with a New terminal action', async () => {
    renderScene('terminal-studio-empty');
    await settle();

    expect(screen.getByText('No terminal yet')).toBeDefined();
    expect(screen.queryByRole('complementary', { name: 'Terminals' })).toBeNull();
    const buttons = screen.getAllByRole('button', { name: 'New terminal' });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0] ?? document.body);
    await settle();

    const tabs = store.getState().terminalTabs['ws:mock-u24-workspace-harborline'] ?? [];
    expect(tabs).toHaveLength(1);
    expect(tabs[0]?.cwd).toBe('/mock/harborline');
  });
});
