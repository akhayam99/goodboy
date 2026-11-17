// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../store/storyHarness';
import { queueOnlyInvoke } from '../../../../../test/queueOnlyInvoke';
import { autoGroupOf } from '../../../../../features/auto/autoGroupOf';
import { AUTO_SESSION } from '../u24/autoSceneSeed';
import { U25_C07_AUTO_SCENES } from './c07-auto';
import type { StoryStore } from '../../../../../store/storyHarness';

const WAIT = { timeout: 15_000 };

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command?: unknown, args?: unknown) =>
    queueOnlyInvoke({ command, args }),
  );
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const mount = (): void => {
  const Scene = U25_C07_AUTO_SCENES['c07-auto-lead-tidy'];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the Lead tidies its run after a replan', () => {
  it('asks in the dock before it drops the plan, and keeps Approve as the one filled button', async () => {
    mount();

    const line = await screen.findByText(
      'The Lead wants to drop plan v1: a new plan with everything we said replaces it',
      undefined,
      WAIT,
    );
    const dock = line.closest<HTMLElement>('[data-dock-plan="discard_asked"]');
    expect(dock).not.toBeNull();
    const row = within(dock ?? document.body);
    expect(row.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Open plan',
      'Drop plan v1',
      'Approve and start Build',
    ]);
  });

  it('shows the agent the Lead closed as done with its reason', async () => {
    mount();
    await screen.findByText(/The Lead wants to drop plan v1/, undefined, WAIT);

    const view = store.getState().autoTreeViews[AUTO_SESSION.id]?.[0];
    const agents = store.getState().sessionPhaseRuns[AUTO_SESSION.id] ?? [];
    const group = view === undefined ? null : autoGroupOf({ view, agents, now: Date.now() });
    expect(group?.children.map((child) => child.reason)).toContain(
      'Closed by the Lead: not needed after the new plan',
    );
  });
});
