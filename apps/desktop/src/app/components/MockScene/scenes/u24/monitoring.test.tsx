// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { U24_MONITORING_SCENES } from './monitoring';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.spyOn(document, 'hasFocus').mockImplementation(() => true);
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
  vi.restoreAllMocks();
});

const renderScene = (name: keyof typeof U24_MONITORING_SCENES) => {
  const Scene = U24_MONITORING_SCENES[name];
  return render(<Scene />);
};

const settle = (): Promise<void> =>
  act(() => new Promise<void>((resolve) => window.setTimeout(resolve, 150)));

const portRow = (port: number): HTMLElement => {
  const row = document.querySelector(`[data-port-row="${port}"]`);
  if (!(row instanceof HTMLElement)) {
    throw new Error(`no row for :${port}`);
  }
  return row;
};

const hasPortRow = (port: number): boolean =>
  document.querySelector(`[data-port-row="${port}"]`) !== null;

describe('the monitoring scenes', () => {
  it('names the worktree that holds :5005 and links the chip to its session', async () => {
    renderScene('monitoring-ports');
    await waitFor(() => expect(hasPortRow(5005)).toBe(true));
    const row = portRow(5005);

    const chip = within(row).getByRole('button', {
      name: 'Open session: payments-api · hl/fix-duplicate-credit',
    });
    const navigate = vi.fn();
    act(() => store.setState({ navigate }));
    fireEvent.click(chip);

    expect(navigate).toHaveBeenCalledWith({
      to: expect.objectContaining({ at: 'session', sessionId: 'mock-u24-session-credit' }),
    });
    expect(within(row).getByText('web')).toBeDefined();
  });

  it('says how many other worktrees run agents against a held port', async () => {
    renderScene('monitoring-ports');
    await waitFor(() => expect(hasPortRow(5005)).toBe(true));

    expect(within(portRow(5005)).getByText('Also in 2 other worktrees')).toBeDefined();
  });

  it('shows a free workspace port as one dim Free line', async () => {
    renderScene('monitoring-ports');
    await waitFor(() => expect(hasPortRow(5002)).toBe(true));
    const row = portRow(5002);

    expect(within(row).getByText('blog')).toBeDefined();
    expect(within(row).getByText('Free')).toBeDefined();
  });

  it('counts the ports in use across Pinned, Run by Goodboy and From workspace', async () => {
    renderScene('monitoring-ports');
    await waitFor(() => expect(hasPortRow(5005)).toBe(true));

    expect(screen.getByText(/^1 of 2 tracked ports in use · updated /)).toBeDefined();
  });

  it('narrows the rows by port and by project name', async () => {
    renderScene('monitoring-ports');
    await waitFor(() => expect(hasPortRow(5005)).toBe(true));
    const filter = screen.getByRole('searchbox', { name: 'Filter ports' });

    fireEvent.change(filter, { target: { value: '5002' } });
    expect(hasPortRow(5002)).toBe(true);
    expect(hasPortRow(5005)).toBe(false);

    fireEvent.change(filter, { target: { value: 'ledger' } });
    expect(hasPortRow(3000)).toBe(true);
    expect(hasPortRow(5005)).toBe(false);
  });

  it('starts the Listening on this Mac fold closed and counts what is inside', async () => {
    renderScene('monitoring-ports');
    await waitFor(() => expect(hasPortRow(5005)).toBe(true));

    const fold = screen.getByRole('button', { name: /^Listening on this Mac/ });
    expect(fold.getAttribute('aria-expanded')).toBe('false');
    expect(fold.textContent).toContain('2 more');
    expect(hasPortRow(7000)).toBe(false);
  });

  it('moves a row into Pinned when Pin is pressed on it', async () => {
    renderScene('monitoring-alsolistening');
    await waitFor(() => expect(hasPortRow(5005)).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: /^Listening on this Mac/ }));
    const listening = screen.getByRole('region', { name: 'Listening on this Mac' });
    expect(within(listening).getByText(':3000')).toBeDefined();

    fireEvent.click(within(listening).getByRole('button', { name: 'Actions for :3000' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Pin' }));
    await waitFor(() => {
      const pinned = screen.getByRole('region', { name: 'Pinned' });
      expect(within(pinned).getByText(':3000')).toBeDefined();
    });

    expect(
      within(screen.getByRole('region', { name: 'Listening on this Mac' })).queryByText(':3000'),
    ).toBeNull();
    expect(store.getState().monitorPinned).toEqual([{ port: 3000, description: '' }]);
  });

  it('keeps an external process low key, by name only', async () => {
    renderScene('monitoring-alsolistening');
    await waitFor(() => expect(hasPortRow(5005)).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: /^Listening on this Mac/ }));

    const row = portRow(7000);
    expect(within(row).getAllByText('ControlCenter').length).toBeGreaterThan(0);
    expect(within(row).queryByRole('button', { name: /^Open session/ })).toBeNull();
  });

  it('lists the agents Goodboy started under Run by Goodboy with their worktree', async () => {
    renderScene('monitoring-ports');
    await waitFor(() => expect(hasPortRow(5005)).toBe(true));
    const started = screen.getByRole('region', { name: 'Run by Goodboy' });

    expect(within(started).getAllByText(/^Agent · claude$/)).toHaveLength(2);
    expect(within(started).getByText('payments-api · hl/refund-rounding')).toBeDefined();
  });

  it('shows the process name and reveals the masked command line on demand', async () => {
    renderScene('monitoring-ports');
    await waitFor(() => expect(hasPortRow(5005)).toBe(true));
    const row = portRow(5005);
    expect(within(row).getByText('node')).toBeDefined();
    expect(screen.queryByRole('group', { name: 'Command line' })).toBeNull();

    fireEvent.click(within(row).getByRole('button', { name: 'Show command line' }));
    const line = screen.getByRole('group', { name: 'Command line' });

    expect(line.textContent).toContain('--token=***');
    expect(document.body.textContent ?? '').not.toMatch(/--token=(?!\*\*\*|•)\S/);
  });

  it('shows the empty state with a way to pin a port', async () => {
    renderScene('monitoring-empty');
    await waitFor(() =>
      expect(screen.getByText('Goodboy found no ports in your projects')).toBeDefined(),
    );

    expect(screen.getByRole('button', { name: 'Pin a port' })).toBeDefined();
  });

  it('shows a failed read with a Retry that reads again', async () => {
    renderScene('monitoring-failed');
    await waitFor(() => expect(screen.getByText("Couldn't read ports")).toBeDefined());

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await settle();

    expect(screen.getByText("Couldn't read ports")).toBeDefined();
  });

  it('shows skeleton rows before the first snapshot lands', async () => {
    renderScene('monitoring-ports');

    expect(screen.getByRole('status', { name: 'Reading ports' })).toBeDefined();
    await waitFor(() => expect(hasPortRow(5005)).toBe(true));
  });

  it('stops polling when the page unmounts', async () => {
    const view = renderScene('monitoring-ports');
    await waitFor(() => expect(hasPortRow(5005)).toBe(true));
    const refresh = vi.fn(async () => undefined);
    store.setState({ refreshMonitorSnapshot: refresh });
    vi.useFakeTimers();

    view.unmount();
    await vi.advanceTimersByTimeAsync(20_000);
    vi.useRealTimers();

    expect(refresh).not.toHaveBeenCalled();
  });
});
