// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { U24_MONITORING_STOP_SCENES } from './monitoring-stop';

beforeAll(async () => {
  await importStore();
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

const renderScene = (name: keyof typeof U24_MONITORING_STOP_SCENES) => {
  const Scene = U24_MONITORING_STOP_SCENES[name];
  return render(<Scene />);
};

describe('the leftovers scene', () => {
  it('lists what an earlier run left, with one Stop leftovers button and the sweep line', async () => {
    renderScene('monitoring-leftovers');

    const group = await screen.findByRole('group', { name: 'Leftovers' });
    expect(within(group).getByText('next-server')).toBeDefined();
    expect(
      within(group).getByText(/started by an agent in Round refund totals to minor units/),
    ).toBeDefined();
    expect(within(group).getByRole('button', { name: 'Stop leftovers' })).toBeDefined();
    expect(screen.getByText('Stopped 3 processes left by an earlier run')).toBeDefined();
  });
});

describe('the stop confirm scene', () => {
  it('asks before stopping a process, names who loses the port, in a popover and not in the row', async () => {
    renderScene('monitoring-stopconfirm');

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Stop node on :5005?')).toBeDefined();
    expect(
      within(dialog).getByText('payments-api · hl/fix-duplicate-credit stops with it.'),
    ).toBeDefined();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDefined();
    expect(within(dialog).getByRole('button', { name: 'Stop' })).toBeDefined();
    expect(document.querySelector('[data-port-row="5005"]')?.contains(dialog)).toBe(false);
  });
});

describe('the force stop scene', () => {
  it('offers Force stop once the process outlived the wait', async () => {
    renderScene('monitoring-forcestop');

    await waitFor(
      () => expect(screen.getByRole('button', { name: 'Force stop node' })).toBeDefined(),
      {
        timeout: 5000,
      },
    );
  });
});

describe('the cleanup blocked scene', () => {
  it('blocks removing a worktree a process runs in and offers Stop it', async () => {
    renderScene('cleanup-process-blocked');

    expect(
      await screen.findByText(
        'A process is running in payments-api; stop it before removing this worktree.',
      ),
    ).toBeDefined();
    expect(screen.getByText('Running: node.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Stop it' })).toBeDefined();
  });
});
