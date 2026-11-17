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
  type StoryStore,
} from '../../../../../store/storyHarness';
import { agentPlace } from '../../../../../store/slices/navigation/place';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { COMMENT_RUN_COPY } from '../../../../../features/resolve/commentRunCopy';
import { EXPANDED_THREAD_ID, SESSION, THREAD_IDS } from '../resolveSeed';
import { MOCK_SCENES } from '../..';
import { U47_COMMENT_RUN_SCENES } from './comment-run';
import { COMMENT_RUN_LEAD_ID, COMMENT_RUN_THREAD_IDS } from './CommentRunWorkingScene';

const SETTLE_MS = 2_000;

type SceneName = keyof typeof U47_COMMENT_RUN_SCENES;

type MountParams = {
  readonly name: SceneName;
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
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

const RUN_TITLE = 'Make the retry backoff configurable per endpoint';

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

  it('draws the start form for one comment with the others to add', async () => {
    const form = await mount({ name: 'u47-comment-run-compose-one' });
    expect(sourcesOf({ form })).toEqual([EXPANDED_THREAD_ID]);
    expect(form.querySelectorAll('[data-comment-run-candidate]').length).toBeGreaterThan(0);
  });

  it('shows both comments of one run as In a run, and the run strip in the pane', async () => {
    await settle({ name: 'u47-comment-run-working' });
    const strip = screen.getByRole('region', {
      name: COMMENT_RUN_COPY.runLine({ title: RUN_TITLE }),
    });
    within(strip).getByRole('button', { name: COMMENT_RUN_COPY.openRun });
    expect(strip.textContent).toContain(COMMENT_RUN_COPY.inThisRun({ count: 2 }));
    screen.getByText(COMMENT_RUN_COPY.workingHost);
    const rowWords = COMMENT_RUN_THREAD_IDS.map(
      (threadId) =>
        document.querySelector(`[data-thread-id="${threadId}"] [data-row-state]`)?.textContent,
    );
    expect(rowWords).toEqual(['In a run · Working', 'In a run · Working']);
    const drawer = document.querySelector(`[data-review-drawer="${THREAD_IDS.retryConstant}"]`);
    expect(drawer).not.toBeNull();
    expect(within(drawer as HTMLElement).queryByRole('button', { name: /^Fix/ })).toBeNull();
  });

  it('opens the run from the strip', async () => {
    await settle({ name: 'u47-comment-run-working' });
    const strip = screen.getByRole('region', {
      name: COMMENT_RUN_COPY.runLine({ title: RUN_TITLE }),
    });
    const navigate = vi.fn();
    act(() => {
      useAppStore.setState({ navigate });
    });
    await act(async () => {
      within(strip).getByRole('button', { name: COMMENT_RUN_COPY.openRun }).click();
    });
    expect(navigate).toHaveBeenCalledWith({
      to: agentPlace({ sessionId: SESSION.id, agentId: COMMENT_RUN_LEAD_ID }),
    });
  });

  it('opens the run page with the comments it comes from, each with Open comment', async () => {
    await settle({ name: 'u47-comment-run-working-page' });
    const block = screen.getByRole('region', {
      name: COMMENT_RUN_COPY.fromComments({ count: 2 }),
    });
    expect(
      within(block).getAllByRole('button', { name: COMMENT_RUN_COPY.openComment }),
    ).toHaveLength(2);
    expect(block.textContent).toContain(COMMENT_RUN_COPY.quotedWord({ count: 2 }));
    expect(block.textContent).toContain('src/webhooks/idempotency.ts:24');
  });
});
