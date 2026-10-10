// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { U24_P_PLAN_OWNER_SCENES } from './p-plan-owner';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
  window.history.replaceState(null, '', '/');
});

const WAIT = { timeout: 4_000 };

const renderScene = () => {
  const Scene = U24_P_PLAN_OWNER_SCENES['plan-drawer-approved'];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the plan owner scene', () => {
  it('registers the approved scene', () => {
    expect(Object.keys(U24_P_PLAN_OWNER_SCENES)).toEqual(['plan-drawer-approved']);
  });

  it('opens on Approve over the overview, with nothing that offers Run plan', async () => {
    renderScene();

    await screen.findByTestId('plan-drawer');
    expect(screen.getByTestId('plan-primary').textContent).toBe('Approve');
    expect(screen.queryByRole('button', { name: 'Run plan' })).toBeNull();
  });

  it('approves on its own behind approve=1, closes the drawer and raises one toast', async () => {
    window.history.replaceState(null, '', '/?approve=1');
    renderScene();

    await waitFor(() => expect(useAppStore.getState().drawer).toBeNull(), WAIT);
    expect(await screen.findAllByText('Plan approved', undefined, WAIT)).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Follow the run' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Run plan' })).toBeNull();
  });

  it('reopens as Approved with the run choosing the next step, and no primary', async () => {
    window.history.replaceState(null, '', '/?approve=1');
    renderScene();
    await waitFor(() => expect(useAppStore.getState().drawer).toBeNull(), WAIT);

    fireEvent.click(screen.getByRole('button', { name: 'Review plan' }));

    const chip = await screen.findByTestId('artifact-state-chip');
    expect(chip.textContent).toContain('Approved');
    expect(screen.getByTestId('plan-drawer-reason').textContent).toContain(
      'The run is choosing the next step',
    );
    expect(screen.queryByTestId('plan-primary')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Run plan' })).toBeNull();
  });
});
