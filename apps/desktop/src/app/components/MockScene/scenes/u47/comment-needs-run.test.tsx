// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { StrictMode } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { COMMENT_RUN_COPY } from '../../../../../features/resolve/commentRunCopy';
import { FAILED_RUN_COPY } from '../../../../../features/resolve/failedRunCopy';
import { NEEDS_RUN_COPY } from '../../../../../features/resolve/needsRunCopy';
import { FIX_RUN_THREAD_COPY } from '../../../../../features/resolve/reviewFlowCopy';
import { NEEDS_RUN_FOUND, THREAD_IDS } from '../resolveSeed';
import { MOCK_SCENES } from '../..';
import { U47_COMMENT_NEEDS_RUN_SCENES } from './comment-needs-run';

const SETTLE_MS = 2_000;

type SceneName = keyof typeof U47_COMMENT_NEEDS_RUN_SCENES;

type MountParams = {
  readonly name: SceneName;
};

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
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
});

const mount = async ({ name }: MountParams): Promise<void> => {
  const Scene = U47_COMMENT_NEEDS_RUN_SCENES[name];
  render(
    <StrictMode>
      <ToastProvider>
        <Scene />
      </ToastProvider>
    </StrictMode>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  expect(screen.queryByText('Something went wrong')).toBeNull();
};

const settle = async (): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
};

describe('u47 comment needs a run scenes', () => {
  it('registers every scene', () => {
    for (const name of Object.keys(U47_COMMENT_NEEDS_RUN_SCENES)) {
      expect(MOCK_SCENES[name]).toBeDefined();
    }
  });

  it('says what the fix agent found and makes Start a run the one primary', async () => {
    await mount({ name: 'u47-comment-needs-run' });

    const note = screen.getByRole('region', { name: NEEDS_RUN_COPY.found });
    within(note).getByText('The fix agent stopped: this is bigger than one change');
    within(note).getByText(NEEDS_RUN_FOUND);
    const bar = screen.getByRole('toolbar', { name: 'Comment actions' });
    within(bar).getByRole('button', { name: NEEDS_RUN_COPY.startRun });
    expect(within(bar).queryByRole('button', { name: 'Add a hint' })).toBeNull();
    expect(screen.queryByRole('button', { name: FIX_RUN_THREAD_COPY.retry })).toBeNull();
    expect(screen.queryByRole('button', { name: FIX_RUN_THREAD_COPY.startOver })).toBeNull();
  });

  it('keeps Retry the fix one click away in the menu, on this thread only', async () => {
    await mount({ name: 'u47-comment-needs-run' });
    const retryCouldntFix = vi.fn(async () => undefined);
    store.setState({ retryCouldntFix });

    const note = screen.getByRole('region', { name: NEEDS_RUN_COPY.found });
    fireEvent.click(within(note).getByRole('button', { name: FAILED_RUN_COPY.moreActions }));
    await settle();
    const menu = screen.getByRole('menu');
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toHaveLength(4);
    fireEvent.click(within(menu).getByRole('menuitem', { name: /Retry the fix/ }));
    await settle();

    expect(retryCouldntFix).toHaveBeenCalledOnce();
    expect(retryCouldntFix).toHaveBeenCalledWith(
      expect.objectContaining({ threadIds: [THREAD_IDS.idempotency] }),
    );
  });

  it('opens the start form with the goal ending in what the agent found', async () => {
    await mount({ name: 'u47-comment-needs-run' });

    const bar = screen.getByRole('toolbar', { name: 'Comment actions' });
    fireEvent.click(within(bar).getByRole('button', { name: NEEDS_RUN_COPY.startRun }));
    await settle();

    const form = screen.getByRole('region', { name: COMMENT_RUN_COPY.label });
    const goal = within(form).getByRole<HTMLTextAreaElement>('textbox', {
      name: COMMENT_RUN_COPY.goal,
    });
    expect(goal.value.endsWith(`The fix agent found: ${NEEDS_RUN_FOUND}`)).toBe(true);
    expect(
      [...form.querySelectorAll('[data-comment-run-source]')].map((node) =>
        node.getAttribute('data-comment-run-source'),
      ),
    ).toEqual([THREAD_IDS.idempotency]);
  });

  it('seeds the goal of a start form that was already open when the comments loaded', async () => {
    await mount({ name: 'u47-comment-needs-run-compose' });

    const form = screen.getByRole('region', { name: COMMENT_RUN_COPY.label });
    const goal = within(form).getByRole<HTMLTextAreaElement>('textbox', {
      name: COMMENT_RUN_COPY.goal,
    });
    expect(goal.value.endsWith(`The fix agent found: ${NEEDS_RUN_FOUND}`)).toBe(true);
  });
});
