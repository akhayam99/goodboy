// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { stageInfoOf } from '../../../../../store/slices/session-view/stageInfoOf';
import { MOCK_SCENES } from '../..';
import { FLOW_SESSION_ID } from '../flow-audit/fixtures';
import { U34_PLAN_REVISING_SCENES } from './plan-revising';

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

describe('the u34 plan revising scene', () => {
  it('registers the scene', () => {
    expect(MOCK_SCENES['u34-plan-revising']).toBe(U34_PLAN_REVISING_SCENES['u34-plan-revising']);
  });

  it('shows no Review plan and no review ask while the planner reworks the plan', async () => {
    const Scene = U34_PLAN_REVISING_SCENES['u34-plan-revising'];
    render(
      <ToastProvider>
        <Scene />
      </ToastProvider>,
    );

    await waitFor(() =>
      expect(document.querySelector('[data-orchestrated-tail]')?.textContent).toContain(
        'The planner is revising the plan',
      ),
    );
    expect(screen.queryByRole('button', { name: 'Review plan' })).toBeNull();
    const session = useAppStore.getState().sessions.find((entry) => entry.id === FLOW_SESSION_ID);
    if (session === undefined) {
      throw new Error('The scene session is missing.');
    }
    expect(stageInfoOf(useAppStore.getState(), session).attention).not.toBe('plan-approval');
  });
});
