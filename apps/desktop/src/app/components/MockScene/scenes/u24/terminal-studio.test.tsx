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

const rowOf = (name: string): HTMLElement => {
  const row = screen.getByRole('button', { name, current: undefined }).closest('li');
  if (row === null) {
    throw new Error(`no row for ${name}`);
  }
  return row;
};

const groupNamed = (name: string): HTMLElement => screen.getByRole('region', { name });

describe('the terminal studio scenes', () => {
  it('groups the workspace terminal first, then one group per session with its count', async () => {
    renderScene('terminal-studio');
    await settle();

    const groups = screen.getAllByRole('region').map((group) => group.getAttribute('aria-label'));
    expect(groups).toEqual([
      'Workspace',
      'Round settlement totals to minor units',
      'Back off failed notification retries',
    ]);
    expect(
      within(groupNamed('Round settlement totals to minor units')).getByText('2'),
    ).toBeDefined();
    expect(
      within(groupNamed('Workspace')).getByRole('button', { name: 'harborline' }),
    ).toBeDefined();
  });

  it('expands only the open session and folds the others', async () => {
    renderScene('terminal-studio');
    await settle();

    expect(
      within(groupNamed('Round settlement totals to minor units')).getByRole('button', {
        name: 'payments-api',
      }),
    ).toBeDefined();
    expect(
      within(groupNamed('Back off failed notification retries')).queryByRole('button', {
        name: 'notify-relay',
      }),
    ).toBeNull();

    fireEvent.click(
      within(groupNamed('Back off failed notification retries')).getByRole('button', {
        expanded: false,
      }),
    );
    expect(
      within(groupNamed('Back off failed notification retries')).getByRole('button', {
        name: 'notify-relay',
      }),
    ).toBeDefined();
  });

  it('shows the running command on a busy row and the exit code with Restart on an exited one', async () => {
    renderScene('terminal-studio');
    await settle();

    expect(within(rowOf('payments-api')).getByText('pnpm dev')).toBeDefined();
    expect(within(rowOf('ledger-core')).getByText('exited 127')).toBeDefined();
    expect(within(rowOf('ledger-core')).getByRole('button', { name: 'Restart' })).toBeDefined();
  });

  it('never names a terminal Terminal 2', async () => {
    renderScene('terminal-studio');
    await settle();

    expect(screen.queryByText(/^Terminal \d+$/)).toBeNull();
  });

  it('opens a terminal in that session from the ledger-core chip and selects it', async () => {
    renderScene('terminal-studio');
    await settle();
    const group = groupNamed('Round settlement totals to minor units');
    const before = within(group).getAllByRole('listitem').length;

    fireEvent.click(screen.getByRole('button', { name: 'ledger-core · hl/ledger-rounding' }));
    await settle();

    const rows = within(groupNamed('Round settlement totals to minor units')).getAllByRole(
      'listitem',
    );
    expect(rows).toHaveLength(before + 1);
    const added = (store.getState().terminalTabs['mock-u24-session-ledger'] ?? []).at(-1);
    expect(added?.cwd).toBe('/mock/worktrees/hl-ledger-rounding/ledger-core');
    expect(store.getState().appStudio).toMatchObject({
      kind: 'terminal',
      terminalId: added?.id,
      sessionId: 'mock-u24-session-ledger',
    });
  });

  it('opens a workspace terminal from the Workspace folder chip', async () => {
    renderScene('terminal-studio');
    await settle();

    fireEvent.click(screen.getByRole('button', { name: 'Workspace folder' }));
    await settle();

    const tabs = store.getState().terminalTabs['ws:mock-u24-workspace-harborline'] ?? [];
    expect(tabs).toHaveLength(2);
    expect(tabs.at(-1)?.cwd).toBe('/mock/harborline');
  });

  it('closes an idle row at once, without a confirm', async () => {
    renderScene('terminal-studio');
    await settle();

    fireEvent.click(screen.getByRole('button', { name: 'Close harborline' }));
    await settle();

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(store.getState().terminalTabs['ws:mock-u24-workspace-harborline']).toEqual([]);
  });

  it('asks before closing a busy row and Keep leaves it running', async () => {
    renderScene('terminal-studio');
    await settle();

    fireEvent.click(screen.getByRole('button', { name: 'Close payments-api' }));

    expect(await screen.findByText('pnpm dev is running. Close it?')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }));
    await settle();
    expect(screen.queryByText('pnpm dev is running. Close it?')).toBeNull();
    expect(store.getState().terminalTabs['mock-u24-session-ledger']).toHaveLength(2);
  });

  it('closes the busy row once Close is confirmed', async () => {
    renderScene('terminal-studio');
    await settle();

    fireEvent.click(screen.getByRole('button', { name: 'Close payments-api' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Close' }));
    await settle();

    const titles = (store.getState().terminalTabs['mock-u24-session-ledger'] ?? []).map(
      (tab) => tab.title,
    );
    expect(titles).toEqual(['ledger-core']);
  });

  it('renames a row by double click and Enter, and Escape cancels', async () => {
    renderScene('terminal-studio');
    await settle();

    fireEvent.doubleClick(screen.getByRole('button', { name: 'payments-api' }));
    const input = screen.getByRole('textbox', { name: 'Rename payments-api' });
    fireEvent.change(input, { target: { value: 'api server' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await settle();

    expect(screen.getByRole('button', { name: 'api server' })).toBeDefined();

    fireEvent.doubleClick(screen.getByRole('button', { name: 'api server' }));
    const again = screen.getByRole('textbox', { name: 'Rename api server' });
    fireEvent.change(again, { target: { value: 'discarded' } });
    fireEvent.keyDown(again, { key: 'Escape' });

    expect(screen.getByRole('button', { name: 'api server' })).toBeDefined();
    expect(screen.queryByText('discarded')).toBeNull();
  });

  it('restarts an exited row into a fresh terminal at the same folder', async () => {
    renderScene('terminal-studio');
    await settle();

    fireEvent.click(within(rowOf('ledger-core')).getByRole('button', { name: 'Restart' }));
    await settle();

    const tabs = store.getState().terminalTabs['mock-u24-session-ledger'] ?? [];
    expect(tabs.map((tab) => tab.status)).toEqual(['running', 'running']);
    expect(tabs.at(-1)?.cwd).toBe('/mock/worktrees/hl-ledger-rounding/ledger-core');
  });

  it('trims the cwd to the workspace folder in the location row', async () => {
    renderScene('terminal-studio');
    await settle();

    fireEvent.click(screen.getByRole('button', { name: 'Main checkout' }));
    await settle();

    const location = screen.getByRole('group', { name: 'Open a terminal in' }).parentElement;
    expect(location).not.toBeNull();
    expect(within(location ?? document.body).getByText('payments-api')).toBeDefined();
  });

  it('lists the same targets in the new terminal picker', async () => {
    renderScene('terminal-studio-newmenu');
    await settle();
    fireEvent.click(screen.getByRole('combobox', { name: 'New terminal in' }));

    const list = await screen.findByRole('listbox');
    const names = within(list)
      .getAllByRole('option')
      .map((option) => option.textContent ?? '');
    expect(names).toHaveLength(4);
    expect(names.some((name) => name.startsWith('Workspace folder'))).toBe(true);
    expect(names.some((name) => name.startsWith('ledger-core · hl/ledger-rounding'))).toBe(true);
    expect(names.some((name) => name.startsWith('Main checkout'))).toBe(true);
  });

  it('opens a terminal at the picked target', async () => {
    renderScene('terminal-studio-newmenu');
    await settle();
    fireEvent.click(screen.getByRole('combobox', { name: 'New terminal in' }));

    fireEvent.click(await screen.findByRole('option', { name: /^Main checkout/ }));
    await settle();

    const tabs = store.getState().terminalTabs['mock-u24-session-ledger'] ?? [];
    expect(tabs.at(-1)?.cwd).toBe('/mock/harborline/payments-api');
  });

  it('offers cd only while the shell is idle', async () => {
    renderScene('terminal-studio');
    await settle();
    expect(
      screen.queryByRole('combobox', { name: 'Change directory in this terminal' }),
    ).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'harborline' }));
    await settle();

    expect(
      screen.getByRole('combobox', { name: 'Change directory in this terminal' }),
    ).toBeDefined();
  });

  it('shows the empty state with a New terminal action', async () => {
    renderScene('terminal-studio-empty');
    await settle();

    expect(screen.getByText('No terminal yet')).toBeDefined();
    const buttons = screen.getAllByRole('button', { name: 'New terminal' });
    fireEvent.click(buttons[buttons.length - 1] ?? document.body);
    await settle();

    const tabs = store.getState().terminalTabs['ws:mock-u24-workspace-harborline'] ?? [];
    expect(tabs).toHaveLength(1);
    expect(tabs[0]?.cwd).toBe('/mock/harborline');
  });

  it('renders the same rows inside the session page frame', async () => {
    renderScene('terminal-studio-session');
    await settle();

    expect(screen.getByRole('heading', { name: 'Terminal' })).toBeDefined();
    expect(
      within(groupNamed('Round settlement totals to minor units')).getByRole('button', {
        name: 'payments-api',
      }),
    ).toBeDefined();
    expect(screen.getByTestId('terminal-panel').getAttribute('data-terminal')).toBe(
      'mock-u24-session-ledger::t1',
    );
  });
});
