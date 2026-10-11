// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { mockIPC } from '@tauri-apps/api/mocks';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../test/sceneInvoke';
import { StopControl } from './StopControl';

const STOP_WAIT_MS = 3000;

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  mockIPC((command) => {
    if (command === 'monitor_stop') {
      return new Promise((resolve) => {
        window.setTimeout(
          () => resolve({ outcome: 'still-running', reason: 'The process did not exit in time.' }),
          STOP_WAIT_MS,
        );
      });
    }
    if (command === 'monitor_snapshot') {
      return { listeners: [], processes: [], takenAt: 1, isPlatformSupported: true };
    }
    if (command === 'process_ledger_list') {
      return [];
    }
    return null;
  });
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('StopControl on an external process', () => {
  it('shows Stopping, then Force stop only after the 3 second wait', async () => {
    render(<StopControl pid={4100} name="node" folder="payments-api" spawnId={null} />);

    fireEvent.click(screen.getByRole('button', { name: 'Stop node' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    await act(() => vi.advanceTimersByTimeAsync(10));

    expect(screen.getByText('Stopping')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Force stop node' })).toBeNull();

    await act(() => vi.advanceTimersByTimeAsync(STOP_WAIT_MS));

    expect(screen.getByRole('button', { name: 'Force stop node' })).toBeDefined();
    expect(screen.queryByText('Stopping')).toBeNull();
  });

  it('does not stop anything when the confirm is cancelled', async () => {
    render(<StopControl pid={4100} name="node" folder="payments-api" spawnId={null} />);

    fireEvent.click(screen.getByRole('button', { name: 'Stop node' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await act(() => vi.advanceTimersByTimeAsync(STOP_WAIT_MS));

    expect(screen.queryByText('Stopping')).toBeNull();
    expect(screen.getByRole('button', { name: 'Stop node' })).toBeDefined();
  });
});
