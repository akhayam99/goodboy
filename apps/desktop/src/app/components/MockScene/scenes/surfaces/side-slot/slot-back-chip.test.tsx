// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '../../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../../test/sceneInvoke';
import { SIDE_SLOT_BACK_CHIP_SCENES } from './slot-back-chip';

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
});

type SceneId = keyof typeof SIDE_SLOT_BACK_CHIP_SCENES;

const renderScene = (id: SceneId) => {
  const Scene = SIDE_SLOT_BACK_CHIP_SCENES[id];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const WAIT = { timeout: 4_000 };

describe('the side slot scenes', () => {
  it('registers the plan, swapped and narrow states', () => {
    expect(Object.keys(SIDE_SLOT_BACK_CHIP_SCENES).sort()).toEqual([
      'slot-back-chip',
      'slot-back-chip-narrow',
      'slot-back-chip-swapped',
    ]);
  });

  it('plan: the plan holds the slot and Terminal waits in the chip', async () => {
    renderScene('slot-back-chip');

    await screen.findByTestId('plan-drawer', undefined, WAIT);
    expect(screen.getByRole('button', { name: 'Back to Terminal' })).toBeDefined();
  });

  it('swapped: the chip brings Terminal back and names the plan', async () => {
    renderScene('slot-back-chip');

    fireEvent.click(await screen.findByRole('button', { name: 'Back to Terminal' }, WAIT));

    await waitFor(() => expect(useAppStore.getState().drawer?.kind).toBe('terminal'), WAIT);
    expect(
      await screen.findByRole('button', {
        name: 'Back to Plan · Reconcile the settlement export',
      }),
    ).toBeDefined();
  });

  it('swapped scene: Terminal holds the slot and the plan waits in the chip', async () => {
    renderScene('slot-back-chip-swapped');

    expect(
      await screen.findByRole(
        'button',
        { name: 'Back to Plan · Reconcile the settlement export' },
        WAIT,
      ),
    ).toBeDefined();
    expect(screen.queryByTestId('plan-drawer')).toBeNull();
  });

  it('narrow: the same slot sits over the page', async () => {
    renderScene('slot-back-chip-narrow');

    await screen.findByTestId('plan-drawer', undefined, WAIT);
    expect(screen.getByTestId('slot-back-chip-scene').getAttribute('data-state')).toBe('narrow');
    expect(screen.getByRole('button', { name: 'Back to Terminal' })).toBeDefined();
  });
});
