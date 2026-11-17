// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../store/storyHarness';
import { queueOnlyInvoke } from '../../../../../test/queueOnlyInvoke';
import { dockPlanOf } from '../../../../../features/auto/dockPlanOf';
import { planApprovalInViewOf } from '../../../../../features/auto/chat/planApprovalInViewOf';
import { AUTO_PLAN_ID, AUTO_SESSION } from '../u24/autoSceneSeed';
import { U25_C07_AUTO_SCENES } from './c07-auto';
import type { StoryStore } from '../../../../../store/storyHarness';

const WAIT = { timeout: 15_000 };
const APPROVE = 'Approve and start Build';

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

type MountParams = {
  readonly id: 'c07-auto-plan-replanning' | 'c07-auto-plan-failed' | 'c07-auto-plan-v2';
};

const mount = ({ id }: MountParams): void => {
  const Scene = U25_C07_AUTO_SCENES[id];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

type DockParams = {
  readonly state: string;
};

const dockOf = async ({ state }: DockParams): Promise<HTMLElement> => {
  const found = await screen.findByText(
    (_, element) => element?.getAttribute('data-dock-plan') === state,
    undefined,
    WAIT,
  );
  return found;
};

describe('the plan dock follows what happens to the plan', () => {
  it('says plan v1 is updating to v2 while a new Planner runs, with Approve blocked', async () => {
    mount({ id: 'c07-auto-plan-replanning' });

    const dock = within(await dockOf({ state: 'updating' }));
    dock.getByText('Updating plan v1 to v2');
    dock.getByText('Planner running');
    const approve = dock.getByRole('button', { name: APPROVE });
    expect(approve.hasAttribute('disabled')).toBe(true);
    expect(approve.getAttribute('title')).toBe('The Planner is writing plan v2');
    expect(dock.getByRole('button', { name: 'Ask for changes' }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(screen.queryByText('Plan v1 needs approval')).toBeNull();
    expect(screen.getByRole('textbox').getAttribute('placeholder')).toBe('Message Lead');
  });

  it('says plan v2 failed with the reason, Retry and Keep plan v1', async () => {
    mount({ id: 'c07-auto-plan-failed' });

    const dock = within(await dockOf({ state: 'failed' }));
    dock.getByText('Plan v2 failed');
    dock.getByText('Its new version lost the structure of the plan.');
    expect(dock.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Open plan',
      'Keep plan v1',
      'Retry plan v2',
    ]);
    expect(screen.queryByRole('button', { name: APPROVE })).toBeNull();
  });

  it('Retry plan v2 continues the Planner that failed', async () => {
    mount({ id: 'c07-auto-plan-failed' });
    const dock = within(await dockOf({ state: 'failed' }));
    const continueStoppedAgent = vi.fn(async () => undefined);
    act(() => {
      store.setState({ continueStoppedAgent });
    });

    fireEvent.click(dock.getByRole('button', { name: 'Retry plan v2' }));

    await waitFor(() =>
      expect(continueStoppedAgent).toHaveBeenCalledWith({
        sessionId: AUTO_SESSION.id,
        agentId: 'mock-auto-replanner',
      }),
    );
  });

  it('asks for plan v2 once it is written, and marks v1 superseded in every window', async () => {
    mount({ id: 'c07-auto-plan-v2' });

    const dock = within(await dockOf({ state: 'needs_approval' }));
    dock.getByText('Plan v2 needs approval');
    expect(dock.getByRole('button', { name: APPROVE }).hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('textbox').getAttribute('placeholder')).toBe(
      'Message Lead, or describe changes to plan v2',
    );

    const view = store.getState().autoTreeViews[AUTO_SESSION.id]?.[0];
    const first = view?.artifacts.find((row) => row.artifact.artifactId === AUTO_PLAN_ID);
    expect(view === undefined ? null : dockPlanOf({ view })?.version).toBe(2);
    expect(
      view === undefined || first === undefined ? null : planApprovalInViewOf({ view, row: first }),
    ).toMatchObject({ state: 'superseded', word: 'Superseded' });
  });
});
