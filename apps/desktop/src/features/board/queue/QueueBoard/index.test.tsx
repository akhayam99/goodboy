// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { SessionAttentionReason, SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import { sessionPlace } from '../../../../store/slices/navigation/place';
import { attentionPlace } from '../../../session/attentionPlace';
import {
  harborline,
  ledgerCore,
  openQuestionFor,
  seedColumn,
  sessionOf,
} from '../../../workspace/testing/sessionColumn';
import type { QueueMove } from '../needsYouOf';
import { QueueBoard } from '.';
import { queueLandingOf } from '../queueLandingOf';
import { useQueueSends } from './useQueueSends';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ live_work: [] });
  useQueueSends.setState({ pending: {}, notNow: new Set(), drafts: {}, answerDrafts: {} });
});

afterEach(() => {
  useQueueSends.getState().flushAll();
  cleanup();
});

const quiet = sessionOf({ goal: 'Backfill ledger balances' });
const asking = sessionOf({ goal: 'Fix webhook retries' });
const second = sessionOf({ goal: 'Rate-limit the payout API' });
const WAIT = { timeout: 3000 };

type SessionParams = {
  readonly sessionId: string;
};

const moveIdOf = ({ sessionId }: SessionParams): string =>
  `${sessionId}:question:question-${sessionId}`;

type MoveButtonParams = {
  readonly moveId: string;
};

const moveButton = ({ moveId }: MoveButtonParams): HTMLElement => {
  const found = document.querySelector<HTMLElement>(`button[data-queue-move="${moveId}"]`);
  if (found === null) {
    throw new Error(`no row for ${moveId}`);
  }
  return found;
};

const queueRoot = (): HTMLElement => {
  const found = document.querySelector<HTMLElement>('[data-queue]');
  if (found === null) {
    throw new Error('the Queue is not on screen');
  }
  return found;
};

type LiveRowParams = {
  readonly runId: string;
  readonly sessionId: string;
};

const liveRowOf = ({ runId, sessionId }: LiveRowParams) => ({
  runId,
  sessionId,
  agentId: `implementer-${runId}`,
  mountId: null,
  workflowRunId: null,
  branch: null,
  startedAt: 1,
  quietMs: 0,
  tool: { name: 'Bash', command: 'pnpm test', path: null },
  hasToolCall: true,
  canSeeTools: true,
});

const renderQueue = () =>
  render(
    <ToastProvider>
      <QueueBoard workspaceId={harborline.id} sessions={useAppStore.getState().sessions} />
    </ToastProvider>,
  );

type MoveParams = {
  readonly reason: SessionAttentionReason;
};

const moveOf = ({ reason }: MoveParams): QueueMove => ({
  id: `${asking.id}:${reason}`,
  sessionId: asking.id,
  reason,
  kind: 'page',
  title: reason,
  question: null,
  since: null,
});

describe('the Queue', () => {
  it('says nothing waits, nothing runs and nothing is ready, without a count', () => {
    seedColumn({ store: useAppStore, sessions: [quiet], mounts: [[quiet, ledgerCore]] });
    renderQueue();
    const needsYou = screen.getByRole('region', { name: 'Needs you' });
    within(needsYou).getByText('Nothing waits on you.');
    expect(within(needsYou).queryByText('0')).toBeNull();
    const ready = screen.getByRole('region', { name: 'Ready to merge' });
    within(ready).getByText('Nothing to merge');
    expect(within(ready).queryByText('0')).toBeNull();
    within(screen.getByRole('region', { name: 'Running' })).getByText('Nothing is running');
  });

  it('puts the question that waits on you in Needs you, as the focused Move', () => {
    seedColumn({ store: useAppStore, sessions: [quiet, asking], questions: [asking] });
    renderQueue();
    const needsYou = screen.getByRole('region', { name: 'Needs you' });
    const question = openQuestionFor({ sessionId: asking.id });
    within(needsYou).getByText(question.text);
    expect(needsYou.querySelector('[data-queue-move-focus]')).not.toBeNull();
    expect(within(needsYou).queryByText('Nothing waits on you.')).toBeNull();
  });

  it('shows the recommended answer as the filled choice and Enter sends that one', async () => {
    const answers = vi.fn(async () => undefined);
    seedColumn({ store: useAppStore, sessions: [asking] });
    const question = {
      ...openQuestionFor({ sessionId: asking.id }),
      suggestedAnswers: ['Drop to one minute'],
      recommendedAnswer: 'Keep five minutes',
    };
    useAppStore.setState({
      sessionOpenQuestions: { [asking.id]: [question] },
      answerOpenQuestions: answers,
    });
    renderQueue();
    const preferred = document.querySelector<HTMLElement>('[data-answer-preferred]');
    expect(preferred?.textContent).toBe('Keep five minutes');
    fireEvent.keyDown(queueRoot(), { key: 'Enter' });
    await act(async () => useQueueSends.getState().flushAll());
    expect(answers).toHaveBeenCalledWith(
      asking.id,
      [{ id: question.id, text: question.text, answer: 'Keep five minutes' }],
      null,
    );
  });

  it('keeps a typed answer when another Move takes the focus and comes back', () => {
    seedColumn({ store: useAppStore, sessions: [asking, second], questions: [asking, second] });
    renderQueue();
    const firstId = moveIdOf({ sessionId: asking.id });
    const secondId = moveIdOf({ sessionId: second.id });
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Keep five' } });
    fireEvent.click(moveButton({ moveId: secondId }));
    fireEvent.click(moveButton({ moveId: firstId }));
    expect(screen.getByRole<HTMLInputElement>('textbox').value).toBe('Keep five');
  });

  it('gives the keys back to Needs you when one of its Moves is clicked, and F6 moves the focus', () => {
    seedColumn({ store: useAppStore, sessions: [asking, second], questions: [asking, second] });
    renderQueue();
    const input = screen.getByRole('textbox');
    input.focus();
    fireEvent.keyDown(input, { key: 'F6' });
    expect(queueRoot().getAttribute('data-active-band')).toBe('running');
    expect(document.activeElement?.getAttribute('data-queue-band')).toBe('running');

    fireEvent.click(moveButton({ moveId: moveIdOf({ sessionId: second.id }) }));
    expect(queueRoot().getAttribute('data-active-band')).toBe('needs-you');
  });

  it('moves the Running focus to the agent whose peek was opened', async () => {
    seedColumn({ store: useAppStore, sessions: [asking, second] });
    stubStoryInvoke({
      live_work: [
        liveRowOf({ runId: 'run-1', sessionId: asking.id }),
        liveRowOf({ runId: 'run-2', sessionId: second.id }),
      ],
    });
    renderQueue();
    const target = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('[data-running-row="run-2"]');
      expect(found).not.toBeNull();
      return found;
    }, WAIT);
    if (target === null) {
      throw new Error('the second agent is not running');
    }
    fireEvent.click(target);
    await waitFor(() =>
      expect(
        document.querySelector('[data-running-row="run-2"]')?.getAttribute('aria-current'),
      ).toBe('true'),
    );
    expect(
      document.querySelector('[data-running-row="run-1"]')?.getAttribute('aria-current'),
    ).toBeNull();
  });

  it.each(['open-question', 'needs-approval', 'plan-approval'] as const)(
    'opens the overview with the Move on top for %s, never the desk',
    (reason) => {
      seedColumn({ store: useAppStore, sessions: [asking] });
      expect(queueLandingOf({ state: useAppStore.getState(), move: moveOf({ reason }) })).toEqual(
        sessionPlace({ sessionId: asking.id }),
      );
    },
  );

  it.each(['ci-failed', 'changes-requested', 'fix-needs-you'] as const)(
    'opens %s where the Move acts',
    (reason) => {
      seedColumn({ store: useAppStore, sessions: [asking] });
      const state = useAppStore.getState();
      expect(queueLandingOf({ state, move: moveOf({ reason }) })).toEqual(
        attentionPlace({ state, sessionId: asking.id, reason }),
      );
    },
  );
});
