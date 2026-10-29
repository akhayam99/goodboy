// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { brandId, type OpenQuestionId, type SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { RunPendingDelivery } from '.';

const SESSION_ID = brandId<SessionId>({ value: 'session-settlement' });
const QUESTION_ID = brandId<OpenQuestionId>({ value: 'question-settlement-alias' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({});
  useAppStore.setState({
    pendingOpenQuestionDeliveries: {
      [SESSION_ID]: {
        attemptId: 'attempt-1',
        pairs: [
          {
            id: QUESTION_ID,
            text: 'Keep the legacy settlement route as an alias?',
            answer: 'Keep it',
          },
        ],
        askingAgentIds: [null],
        error: 'The agent is not reachable.',
      },
    },
  });
});

afterEach(cleanup);

describe('RunPendingDelivery', () => {
  it('shows the questions, the answers sent and the error', () => {
    render(<RunPendingDelivery sessionId={SESSION_ID} />);

    const notice = screen.getByRole('region', { name: 'Answers not delivered' });
    expect(notice.textContent).toContain('Keep the legacy settlement route as an alias?');
    expect(notice.textContent).toContain('Keep it');
    expect(within(notice).getByRole('alert').textContent).toContain('The agent is not reachable.');
  });

  it('retries the same attempt and leaves when the store clears it', async () => {
    const retryOpenQuestionDelivery = vi.fn(async () => {
      useAppStore.setState({ pendingOpenQuestionDeliveries: {} });
    });
    useAppStore.setState({ retryOpenQuestionDelivery });
    render(<RunPendingDelivery sessionId={SESSION_ID} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });

    expect(retryOpenQuestionDelivery).toHaveBeenCalledExactlyOnceWith({
      sessionId: SESSION_ID,
      attemptId: 'attempt-1',
    });
    expect(screen.queryByRole('region', { name: 'Answers not delivered' })).toBeNull();
  });

  it('renders nothing for a session with no pending delivery', () => {
    render(<RunPendingDelivery sessionId={brandId<SessionId>({ value: 'session-other' })} />);

    expect(screen.queryByRole('region', { name: 'Answers not delivered' })).toBeNull();
  });
});
