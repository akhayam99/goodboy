// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { MOCK_SCENES } from '../..';
import {
  BLOCKED_BRANCH_A,
  BLOCKED_BRANCH_B,
  BLOCKED_MOUNT_AGENT_ID,
  BLOCKED_MOUNT_B,
  BLOCKED_MOUNT_SESSION_ID,
} from './blockedMountStepSeed';
import { U30_BLOCKED_MOUNT_STEP_SCENES } from './blocked-mount-step';

const SCENE = 'u30-blocked-mount-step';
const SETTLE_MS = 2_000;

const pendingInvoke = () => new Promise<never>(() => undefined);

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({
    db_select: [],
    db_execute: { rowsAffected: 0 },
    worktree_status: pendingInvoke,
    worktree_remote_url: pendingInvoke,
    worktree_changed_files: pendingInvoke,
    turn_quiet: [],
  });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

const mount = async () => {
  const Scene = U30_BLOCKED_MOUNT_STEP_SCENES[SCENE];
  const view = render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  expect(screen.queryByText('Something went wrong')).toBeNull();
  return view;
};

const nodeOf = (selector: string): HTMLElement => {
  const node = document.querySelector<HTMLElement>(selector);
  if (node === null) {
    throw new Error(`no ${selector}`);
  }
  return node;
};

const block = (): HTMLElement => nodeOf('[data-mount-blocked-step]');

describe('the u30 blocked mount step scene', () => {
  it('registers the scene once', () => {
    expect(MOCK_SCENES[SCENE]).toBe(U30_BLOCKED_MOUNT_STEP_SCENES[SCENE]);
  });

  it('frames the run page with the blocked step for the changelog picture', async () => {
    const Shot = U30_BLOCKED_MOUNT_STEP_SCENES['u30-blocked-mount-step-shot'];
    expect(MOCK_SCENES['u30-blocked-mount-step-shot']).toBe(Shot);
    render(
      <ToastProvider>
        <Shot />
      </ToastProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SETTLE_MS);
    });
    expect(nodeOf('[data-shot]').querySelector('[data-mount-blocked-step]')).not.toBeNull();
  });

  it('shows the step as waiting for its branch with the reason and the ways out', async () => {
    await mount();

    expect(nodeOf('[data-orchestrated-tail]').getAttribute('data-orchestrated-tail')).toBe(
      'step-failed',
    );
    expect(
      within(nodeOf('[data-orchestrated-tail]')).queryByText('Paused on blocked step 3'),
    ).toBeNull();
    within(block()).getByText('Step 3 is waiting for a branch');
    expect(block().textContent).toContain(
      `Step 3 needs ${BLOCKED_BRANCH_A}, which was detached from this session.`,
    );
    const actions = within(block())
      .getAllByRole('button')
      .map((button) => button.textContent);
    expect(actions).toEqual([`Reattach ${BLOCKED_BRANCH_A}`, `Use ${BLOCKED_BRANCH_B}`]);
    expect(within(nodeOf('[data-orchestrated-tail]')).queryByRole('form')).toBeNull();
    expect(
      within(nodeOf('[data-orchestrated-tail]')).queryByRole('button', { name: 'Restart step' }),
    ).toBeNull();
  });

  it('names the pin of the current step in the run header, not the active branch', async () => {
    await mount();

    const writesTo = screen.getByText('Writes to').parentElement;
    expect(writesTo?.textContent).toBe(`Writes to${BLOCKED_BRANCH_A}`);
  });

  it('asks the store to reattach the branch the step was pinned to', async () => {
    await mount();
    const resolveMountBlockedStep = vi.fn(async () => undefined);
    act(() => {
      useAppStore.setState({ resolveMountBlockedStep });
    });

    await act(async () => {
      fireEvent.click(
        within(block()).getByRole('button', { name: `Reattach ${BLOCKED_BRANCH_A}` }),
      );
    });

    expect(resolveMountBlockedStep).toHaveBeenCalledWith({
      sessionId: BLOCKED_MOUNT_SESSION_ID,
      agentId: BLOCKED_MOUNT_AGENT_ID,
      choice: { kind: 'reattach' },
    });
  });

  it('asks the store to move the step to the branch the session writes to', async () => {
    await mount();
    const resolveMountBlockedStep = vi.fn(async () => undefined);
    act(() => {
      useAppStore.setState({ resolveMountBlockedStep });
    });

    await act(async () => {
      fireEvent.click(within(block()).getByRole('button', { name: `Use ${BLOCKED_BRANCH_B}` }));
    });

    expect(resolveMountBlockedStep).toHaveBeenCalledWith({
      sessionId: BLOCKED_MOUNT_SESSION_ID,
      agentId: BLOCKED_MOUNT_AGENT_ID,
      choice: { kind: 'use', mountId: BLOCKED_MOUNT_B },
    });
  });

  it('reports the failure and keeps the block when the store refuses', async () => {
    await mount();
    const reportError = vi.fn(async () => undefined);
    act(() => {
      useAppStore.setState({
        reportError,
        resolveMountBlockedStep: vi.fn(async () => {
          throw new Error('That branch is not in this session anymore.');
        }),
      });
    });

    await act(async () => {
      fireEvent.click(within(block()).getByRole('button', { name: `Use ${BLOCKED_BRANCH_B}` }));
    });

    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't start the step" }),
    );
    expect(block().textContent).toContain(BLOCKED_BRANCH_A);
  });

  it('has no accessibility violations', async () => {
    const view = await mount();

    vi.useRealTimers();
    const { violations } = await runA11yCheck(view.container);

    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
