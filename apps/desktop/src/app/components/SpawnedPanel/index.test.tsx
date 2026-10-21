// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../shared/components/Toast';
import { STORE_IMPORT_TIMEOUT_MS, importStore, resetStoryStore } from '../../../store/storyHarness';
import { useAppStore } from '../../../store';
import { clearSceneInvoke } from '../../../test/sceneInvoke';
import { C08_SESSION_ID } from '../MockScene/scenes/u25/c08RunSeed';
import { U25_C08_PRESET_RUN_SCENES } from '../MockScene/scenes/u25/c08-preset-run';

const SETTLE_MS = 2_000;

type SceneName = keyof typeof U25_C08_PRESET_RUN_SCENES;

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

const settle = async (): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
};

const mount = async (name: SceneName): Promise<void> => {
  const Scene = U25_C08_PRESET_RUN_SCENES[name];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await settle();
};

const panelMode = (): string | null =>
  document.querySelector('[data-spawned-panel]')?.getAttribute('data-spawned-panel') ?? null;

const panel = (): HTMLElement => screen.getByRole('region', { name: 'Agents' });

describe('the Agents panel', () => {
  it('follows the open run, lists every launch on All launches, and follows the run picked there', async () => {
    await mount('c08-run-working');

    expect(panelMode()).toBe('run');
    expect(within(panel()).getByText('Fix flaky tests in the ledger export')).toBeDefined();

    fireEvent.click(within(panel()).getByRole('button', { name: 'All launches' }));
    expect(panelMode()).toBe('all');
    const launches = within(panel()).getByRole('tree', { name: 'Launches' });
    const heads = within(launches)
      .getAllByRole('treeitem')
      .filter((item) => item.getAttribute('aria-level') === '1');
    expect(heads.length).toBeGreaterThan(1);
    const other = heads.find((item) =>
      (item.getAttribute('aria-label') ?? '').startsWith('Document the payments-api retry cap'),
    );
    if (other === undefined) {
      throw new Error('no second run in the launches');
    }

    fireEvent.click(other);
    await settle();

    expect(useAppStore.getState().drawer?.kind).toBe('spawned');
    expect(panelMode()).toBe('run');
    expect(within(panel()).getByText('Document the payments-api retry cap')).toBeDefined();
    expect(useAppStore.getState().focusedWorkflowRunId[C08_SESSION_ID]).not.toBeNull();
  });

  it('opens a step transcript from the tree and comes back to the same run', async () => {
    await mount('c08-run-working');

    const tree = within(panel()).getByRole('tree', { name: 'Run agents' });
    const [first] = within(tree).getAllByRole('treeitem');
    if (first === undefined) {
      throw new Error('the run has no step');
    }
    act(() => first.focus());
    fireEvent.keyDown(first, { key: 'Enter' });
    await settle();

    const drawer = useAppStore.getState().drawer;
    expect(drawer?.kind).toBe('run-step');
    expect(screen.queryByRole('region', { name: 'Agents' })).toBeNull();

    const back = screen.getByRole('button', { name: 'Back to agents' });
    expect(back.closest('[data-drawer-back]')).not.toBeNull();
    fireEvent.click(back);
    await settle();

    expect(useAppStore.getState().drawer?.kind).toBe('spawned');
    expect(screen.getByRole('region', { name: 'Agents' })).toBeDefined();
    expect(panelMode()).toBe('run');
  });

  it('closes on Close and leaves the run page as it was', async () => {
    await mount('c08-run-working');

    fireEvent.click(within(panel()).getByRole('button', { name: 'Close' }));
    await settle();

    expect(useAppStore.getState().drawer).toBeNull();
    expect(document.querySelector('[data-run-step-heading]')?.textContent).toBe(
      'Step 2 · Implementer',
    );
  });
});
