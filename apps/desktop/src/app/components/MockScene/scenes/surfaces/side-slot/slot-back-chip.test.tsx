// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../../../../../test/sceneInvoke';
import { SIDE_SLOT_BACK_CHIP_SCENES } from './slot-back-chip';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  clearSceneInvoke();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
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

const PLAN_CHIP = 'Back to Plan · Reconcile the settlement export';

describe('the side slot scenes', () => {
  it('registers the plan, swapped and narrow states', () => {
    expect(Object.keys(SIDE_SLOT_BACK_CHIP_SCENES).sort()).toEqual([
      'slot-back-chip',
      'slot-back-chip-narrow',
      'slot-back-chip-swapped',
    ]);
  });

  it('plan: the plan opens as the detail panel beside the Terminal dock, with no chip', async () => {
    renderScene('slot-back-chip');

    const plan = await screen.findByTestId('plan-drawer', undefined, WAIT);
    expect(plan.closest('[data-container="detail"]')).not.toBeNull();
    expect(document.querySelector('[data-container="drawer"] [data-drawer-card]')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Back to Terminal' })).toBeNull();
  });

  it('swapped: closing the plan leaves the Terminal dock open alone', async () => {
    renderScene('slot-back-chip');
    const plan = await screen.findByTestId('plan-drawer', undefined, WAIT);
    const detail = plan.closest<HTMLElement>('[data-container="detail"]');
    if (detail === null) {
      throw new Error('the plan sits in the detail panel');
    }

    fireEvent.click(within(detail).getAllByRole('button', { name: 'Close' })[0]!);

    await waitFor(() => expect(useAppStore.getState().drawer?.kind).toBe('terminal'), WAIT);
    expect(useAppStore.getState().drawerBack).toBeNull();
  });

  it('swapped scene: Terminal on top still shows the plan beside it, no chip', async () => {
    renderScene('slot-back-chip-swapped');

    await screen.findByTestId('plan-drawer', undefined, WAIT);
    expect(screen.queryByRole('button', { name: PLAN_CHIP })).toBeNull();
  });

  it('narrow: the same pair keeps both panels in one side column', async () => {
    renderScene('slot-back-chip-narrow');

    const plan = await screen.findByTestId('plan-drawer', undefined, WAIT);
    expect(screen.getByTestId('slot-back-chip-scene').getAttribute('data-state')).toBe('narrow');
    const side = screen.getByRole('complementary', { name: 'Side panel' });
    expect(side.contains(plan)).toBe(true);
    expect(side.querySelector('[data-drawer-card]')).not.toBeNull();
  });
});
