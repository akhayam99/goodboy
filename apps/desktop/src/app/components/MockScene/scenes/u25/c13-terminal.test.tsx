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
import { MOCK_SCENES } from '../..';
import { U25_C13_TERMINAL_SCENES } from './c13-terminal';

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

const settle = (ms = 150): Promise<void> =>
  act(() => new Promise<void>((resolve) => window.setTimeout(resolve, ms)));

const renderScene = async (name: keyof typeof U25_C13_TERMINAL_SCENES): Promise<void> => {
  const Scene = U25_C13_TERMINAL_SCENES[name];
  render(<Scene />);
  await settle(400);
};

const grid = (): HTMLElement => screen.getByRole('list', { name: 'Terminals' });

const row = (name: string): HTMLElement => within(grid()).getByRole('button', { name });

describe('c13 terminal scenes', () => {
  it('registers every state', () => {
    for (const [id, scene] of Object.entries(U25_C13_TERMINAL_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(scene);
    }
  });

  it('lists one group per session with its row count from two, the workspace folder last', async () => {
    await renderScene('c13-terminal');

    const headings = within(grid()).getAllByRole('heading', { level: 2 });
    expect(headings.map((heading) => heading.textContent)).toEqual([
      'Ledger export speed up',
      'Northwind webhook retries',
      'Workspace folder',
    ]);
    const counts = headings.map(
      (heading) => heading.closest('li')?.querySelector('[data-list-grid-count]')?.textContent,
    );
    expect(counts).toEqual(['2', undefined, undefined]);
  });

  it('draws one line per worktree with a running dot and no facts of the session', async () => {
    await renderScene('c13-terminal');

    const payments = row('payments-api · mara/ledger-export');
    expect(payments.getAttribute('aria-current')).toBe('true');
    expect(within(payments).getByRole('img', { name: 'Running a process' })).toBeDefined();
    expect(payments.textContent).not.toContain(':10350');
    expect(within(grid()).queryByText('HBL-412')).toBeNull();
    expect(within(grid()).queryByText('+117')).toBeNull();
    expect(within(grid()).queryByText(/gb-7k2q9x/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Open localhost:10350' })).toBeDefined();
  });

  it('shows the port on the dev server row once another worktree is selected', async () => {
    await renderScene('c13-terminal-other');

    expect(row('ledger-core · mara/ledger-export').getAttribute('aria-current')).toBe('true');
    expect(row('payments-api · mara/ledger-export').textContent).toContain(':10350');
  });

  it('opens the menu of the tab strip with Copy worktree path and Open session', async () => {
    await renderScene('c13-terminal-menu');
    await settle(400);

    expect(screen.getByRole('menuitem', { name: 'Copy worktree path' })).toBeDefined();
    expect(screen.getByRole('menuitem', { name: 'Open session' })).toBeDefined();
  });

  it('gives the workspace folder a quiet Copy folder path instead of a menu of one', async () => {
    await renderScene('c13-terminal-workspace');
    await settle(400);

    expect(screen.getByRole('button', { name: 'Copy folder path' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /^More on/ })).toBeNull();
    expect(within(grid()).queryByRole('button', { name: /^Open session Workspace/ })).toBeNull();
  });

  it('opens the session from the tab strip menu', async () => {
    const navigate = vi.fn();
    store.setState({ navigate });
    await renderScene('c13-terminal');

    fireEvent.click(screen.getByRole('button', { name: 'More on payments-api' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Open session' }));

    expect(navigate).toHaveBeenCalledWith({
      to: expect.objectContaining({ at: 'session', sessionId: 'mock-c13-session-ledger-export' }),
    });
  });

  it('shows the empty page with one New terminal and no list', async () => {
    await renderScene('c13-terminal-empty');

    expect(screen.getByText('No terminal yet')).toBeDefined();
    expect(screen.queryByRole('list', { name: 'Terminals' })).toBeNull();
  });
});
