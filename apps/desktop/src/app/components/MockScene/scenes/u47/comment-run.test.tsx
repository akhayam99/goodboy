// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { COMMENT_RUN_COPY } from '../../../../../features/resolve/commentRunCopy';
import { EXPANDED_THREAD_ID, THREAD_IDS } from '../resolveSeed';
import { MOCK_SCENES } from '../..';
import { U47_COMMENT_RUN_SCENES } from './comment-run';

const SETTLE_MS = 2_000;

type SceneName = keyof typeof U47_COMMENT_RUN_SCENES;

type MountParams = {
  readonly name: SceneName;
};

beforeAll(async () => {
  await importStore();
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

const settle = async ({ name }: MountParams): Promise<void> => {
  const Scene = U47_COMMENT_RUN_SCENES[name];
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

const mount = async ({ name }: MountParams): Promise<HTMLElement> => {
  await settle({ name });
  return screen.getByRole('region', { name: COMMENT_RUN_COPY.label });
};

type FormParams = {
  readonly form: HTMLElement;
};

const sourcesOf = ({ form }: FormParams): ReadonlyArray<string | null> =>
  [...form.querySelectorAll('[data-comment-run-source]')].map((node) =>
    node.getAttribute('data-comment-run-source'),
  );

describe('u47 comment run scenes', () => {
  it('registers every scene', () => {
    for (const name of Object.keys(U47_COMMENT_RUN_SCENES)) {
      expect(MOCK_SCENES[name]).toBeDefined();
    }
  });

  it('draws the start form in the drawer with two comments as sources', async () => {
    const form = await mount({ name: 'u47-comment-run-compose' });
    expect(sourcesOf({ form })).toEqual([EXPANDED_THREAD_ID, THREAD_IDS.retryConstant]);
    expect(
      within(form).getByRole<HTMLTextAreaElement>('textbox', { name: COMMENT_RUN_COPY.goal }).value,
    ).toMatch(/as the comments ask/);
    within(form).getByRole('button', { name: 'Start' });
    within(form).getByRole('button', { name: COMMENT_RUN_COPY.cancel });
  });

  it('leads a broad comment with Start a run and says why, the fix left to the menu', async () => {
    await settle({ name: 'u47-comment-run-suggest' });
    const bar = screen.getByRole('toolbar', { name: 'Comment actions' });
    const primary = bar.querySelector('[data-review-verb="reviewComment.startRun"]');
    expect(primary?.textContent).toContain(COMMENT_RUN_COPY.startRun);
    expect(bar.querySelector('[data-review-verb="reviewComment.draft"]')).toBeNull();
    const suggestion = document.querySelector('[data-comment-run-suggest]');
    expect(suggestion?.textContent).toContain(COMMENT_RUN_COPY.suggestTitle);
    expect(suggestion?.textContent).toContain('the payouts route');
  });

  it('draws the start form for one comment with the others to add', async () => {
    const form = await mount({ name: 'u47-comment-run-compose-one' });
    expect(sourcesOf({ form })).toEqual([EXPANDED_THREAD_ID]);
    expect(form.querySelectorAll('[data-comment-run-candidate]').length).toBeGreaterThan(0);
  });
});
