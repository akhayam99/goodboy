// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TEST_NOW, nextProviderRunId } from '@goodboy/types/testing';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { FixRunMultiScene } from '../MockScene/scenes/FixRunMultiScene';
import { EXPANDED_THREAD_ID, SESSION_ID, THREAD_IDS } from '../MockScene/scenes/resolveSeed';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const tabNamed = (name: string): HTMLElement =>
  screen.getByRole('tab', { name: new RegExp(`^${name}`) });

const isSelected = (name: string): boolean =>
  tabNamed(name).getAttribute('aria-selected') === 'true';

const askOn = ({ threadId }: { readonly threadId: string }): void => {
  act(() => {
    const queue = useAppStore.getState().sessionResolveQueueItems[SESSION_ID] ?? [];
    useAppStore.setState({
      sessionResolveQueueItems: {
        [SESSION_ID]: queue.map((entry) =>
          entry.thread.threadId === threadId
            ? {
                item: entry.item,
                thread: {
                  ...entry.thread,
                  stage: 'asking' as const,
                  question: 'Should exhausted retries return a 200 with a warning, or fail hard?',
                },
              }
            : entry,
        ),
      },
    });
  });
};

const renderWorkingRun = async (): Promise<void> => {
  render(
    <ToastProvider>
      <FixRunMultiScene />
    </ToastProvider>,
  );
  await screen.findByRole('tab', { name: 'Transcript' });
};

describe('the fix run drawer tabs on a live run', () => {
  it('moves to Fix when a working run starts to ask', async () => {
    await renderWorkingRun();
    expect(isSelected('Transcript')).toBe(true);

    askOn({ threadId: EXPANDED_THREAD_ID });

    expect(isSelected('Fix')).toBe(true);
    expect(screen.queryByRole('status', { name: 'Question waiting' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Message to Fix run' })).toBeNull();
  });

  it('marks Fix when a question arrives on a run whose Transcript the user chose', async () => {
    await renderWorkingRun();
    fireEvent.click(tabNamed('Transcript'));

    askOn({ threadId: THREAD_IDS.metrics });

    expect(isSelected('Transcript')).toBe(true);
    expect(screen.getByRole('status', { name: 'Question waiting' })).toBeDefined();

    fireEvent.click(tabNamed('Fix'));
    expect(screen.queryByRole('status', { name: 'Question waiting' })).toBeNull();
  });

  it('shows the brief as one closed card on Transcript and opens it on click', async () => {
    await renderWorkingRun();

    await screen.findByTestId('chat-brief-card');
    const trigger = screen.getByRole('button', { name: /^4 comments from #\d+$/ });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('marks Transcript when the run speaks while the user reads Fix', async () => {
    await renderWorkingRun();
    fireEvent.click(tabNamed('Fix'));
    const agentId = Object.keys(useAppStore.getState().transcripts)[0] ?? '';

    act(() => {
      const events = useAppStore.getState().transcripts;
      useAppStore.setState({
        transcripts: {
          ...events,
          [agentId]: [
            ...(events[agentId] ?? []),
            {
              kind: 'assistant_text',
              runId: nextProviderRunId(),
              delta: 'Pushing the commits now.',
              at: TEST_NOW,
            },
          ],
        },
      });
    });

    expect(screen.getByRole('status', { name: 'New activity' })).toBeDefined();
  });
});
