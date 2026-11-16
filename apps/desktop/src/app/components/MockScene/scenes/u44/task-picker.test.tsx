// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { WORKSPACE_ID } from '../BoardScene';
import { U44_TASK_PICKER_SCENES } from './task-picker';

const SETTLE_MS = 3_000;

const NAMES = [
  'u44-task-picker-all',
  'u44-task-picker-sentry',
  'u44-task-picker-error',
  'u44-task-picker-loading',
] as const;

type SceneName = (typeof NAMES)[number];

type MountParams = {
  readonly name: SceneName;
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
  localStorage.clear();
});

const mount = async ({ name }: MountParams): Promise<void> => {
  const Scene = U44_TASK_PICKER_SCENES[name];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  expect(screen.queryByText('Something went wrong')).toBeNull();
};

const optionNames = (): ReadonlyArray<string | null> =>
  within(screen.getByRole('listbox', { name: 'Tasks' }))
    .queryAllByRole('option')
    .map((option) => option.getAttribute('aria-label'));

const sourceTab = (name: RegExp): HTMLElement =>
  within(screen.getByRole('tablist', { name: 'Task sources' })).getByRole('tab', { name });

describe('the u44 task picker scenes', () => {
  it('registers every scene', () => {
    expect(Object.keys(U44_TASK_PICKER_SCENES).sort()).toEqual([...NAMES].sort());
    for (const name of NAMES) {
      expect(MOCK_SCENES[name]).toBe(U44_TASK_PICKER_SCENES[name]);
    }
  });

  it('opens on Linear, GitHub and Sentry tasks grouped by source', async () => {
    await mount({ name: 'u44-task-picker-all' });

    sourceTab(/^All/);
    sourceTab(/^GitHub/);
    sourceTab(/^Linear/);
    sourceTab(/^Sentry/);
    expect(optionNames()).toEqual([
      '#418 Stream the ledger export instead of buffering it',
      '#402 Webhook signatures fail after the notify-relay key rotation',
      'HBL-412 Ledger export times out over 10k rows when the merchant has split payouts enabled',
      'HBL-415 Refund runs twice on a retried charge',
      'HBL-398 Show the payout hold reason on the merchant page',
      'PAYMENTS-API-7F2 TypeError: cannot read properties of undefined (reading payout)',
      'NOTIFY-RELAY-2F Timeout delivering a webhook to Northwind',
    ]);
  });

  it('fills the draft with the picked task', async () => {
    await mount({ name: 'u44-task-picker-all' });

    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Search tasks' }), { key: 'Enter' });

    expect(
      useAppStore
        .getState()
        .sessionDrafts[WORKSPACE_ID]?.pickedIssues.map((task) => task.identifier),
    ).toEqual(['#418']);
  });

  it('opens on the remembered Sentry source', async () => {
    await mount({ name: 'u44-task-picker-sentry' });

    expect(sourceTab(/^Sentry/).getAttribute('aria-selected')).toBe('true');
    expect(optionNames()).toHaveLength(2);
  });

  it('shows Linear failing inline with Retry and the rest listed', async () => {
    await mount({ name: 'u44-task-picker-error' });

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain("Couldn't load Linear tasks");
    within(alert).getByRole('button', { name: 'Retry' });
    expect(optionNames()).toHaveLength(4);
  });

  it('holds skeleton rows while every source loads', async () => {
    await mount({ name: 'u44-task-picker-loading' });

    expect(screen.getAllByRole('status', { name: 'Loading tasks' }).length).toBeGreaterThan(0);
    expect(optionNames()).toEqual([]);
  });
});
