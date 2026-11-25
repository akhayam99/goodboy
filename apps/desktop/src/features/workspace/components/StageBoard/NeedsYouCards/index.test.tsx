// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../store/storyHarness')).dbModuleMock(),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { aProject, aSession, aWorkspace, anAgent } from '@goodboy/types/testing';
import {
  brandId,
  type IsoDateTime,
  type OpenQuestion,
  type OpenQuestionId,
  type Session,
} from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { useNowSessions } from '../../../../../shared/hooks/useNowSessions';
import { attentionTargetChannel } from '../../../../session/attentionTargetChannel';
import { useOpenQuestions } from '../../../../context/components/QuestionsTab/useOpenQuestions';
import { stagesNavigationOf } from '../../../testing/stagesNavigationOf';
import { mountOf, runningState } from '../../../testing/sessionColumn';
import { StageBoard } from '../index';

const workspace = aWorkspace({ name: 'Harborline', slug: 'harborline' });
const northwind = aWorkspace({ name: 'Northwind', slug: 'northwind' });
const project = aProject({ workspaceId: workspace.id, name: 'ledger-core', kind: 'folder' });

const ERROR_AT = brandId<IsoDateTime>({ value: '2026-10-07T08:00:00.000Z' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  useOpenQuestions.setState({ staged: [] });
  vi.restoreAllMocks();
});

type SessionParams = {
  readonly goal: string;
  readonly isFailed?: boolean;
  readonly isRunning?: boolean;
};

const sessionOf = ({ goal, isFailed = false, isRunning = false }: SessionParams): Session =>
  aSession({
    workspaceId: workspace.id,
    goal,
    ...(isFailed && {
      state: { kind: 'error', message: 'provider gave up', failedAt: ERROR_AT },
    }),
    ...(isRunning && { state: runningState() }),
  });

type QuestionParams = {
  readonly session: Session;
  readonly text: string;
  readonly minute: number;
};

const questionOf = ({ session, text, minute }: QuestionParams): OpenQuestion => ({
  id: brandId<OpenQuestionId>({ value: `question-${session.id}-${minute}` }),
  sessionId: session.id,
  text,
  suggestedAnswers: ['Keep five minutes', 'Drop to one minute'],
  isBlocking: true,
  userAnswer: null,
  status: 'open',
  createdAt: brandId<IsoDateTime>({
    value: `2026-10-07T09:${String(minute).padStart(2, '0')}:00.000Z`,
  }),
});

type SeedParams = {
  readonly sessions: ReadonlyArray<Session>;
  readonly questions?: ReadonlyArray<OpenQuestion>;
};

const seed = ({ sessions, questions = [] }: SeedParams): void => {
  const asked: Record<string, Array<OpenQuestion>> = {};
  for (const question of questions) {
    asked[question.sessionId] = [...(asked[question.sessionId] ?? []), question];
  }
  useAppStore.setState({
    workspaces: [workspace, northwind],
    projects: [project],
    sessions: [...sessions],
    sessionOpenQuestions: asked,
    archivedSessions: { [workspace.id]: [] },
    boardReady: true,
    currentWorkspaceId: workspace.id,
    navigation: stagesNavigationOf({ state: useAppStore.getState(), workspaceId: workspace.id }),
    loadArchivedSessions: async () => undefined,
  });
};

const railCounts: Array<number> = [];

const RailBadgeProbe = () => {
  const { attention } = useNowSessions({});
  railCounts.push(attention.count);
  return null;
};

const mountBoard = (sessions: ReadonlyArray<Session>) =>
  render(
    <ToastProvider>
      <RailBadgeProbe />
      <StageBoard workspaceId={workspace.id} sessions={sessions} />
    </ToastProvider>,
  );

const runningLane = (): HTMLElement => screen.getByRole('group', { name: 'running' });

const cards = (): ReadonlyArray<HTMLElement> =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-needs-you-card]'));

type CardParams = {
  readonly index: number;
};

const cardAt = ({ index }: CardParams): HTMLElement => {
  const card = cards()[index];
  if (card === undefined) {
    throw new Error(`the Running lane has no needs you card ${index}`);
  }
  return card;
};

const frameAt = ({ index }: CardParams): HTMLElement => {
  const frame = cardAt({ index }).parentElement;
  if (frame === null) {
    throw new Error(`card ${index} has no frame`);
  }
  return frame;
};

const currentPlace = () => {
  const stack = useAppStore.getState().navigation[workspace.id];
  return stack?.entries[stack.index]?.place;
};

const ROUTING_WORDS = ['Balanced', 'In order', 'most room', 'Send new steps to'];

const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING;

describe('NeedsYouCards', () => {
  it('draws no Needs you strip above the stages, only cards inside the Running lane', () => {
    const asking = sessionOf({ goal: 'Fix the rounding drift in the settlement export' });
    seed({
      sessions: [asking],
      questions: [
        questionOf({ session: asking, text: 'Keep the retry window at five minutes?', minute: 1 }),
      ],
    });
    mountBoard([asking]);

    expect(screen.queryByRole('region', { name: 'Needs you' })).toBeNull();
    expect(cards()).toHaveLength(1);
    expect(runningLane().contains(cardAt({ index: 0 }))).toBe(true);
  });

  it('shows one card per counted session, and Running counts them like the rail badge', () => {
    const asking = sessionOf({ goal: 'Fix the rounding drift in the settlement export' });
    const failing = sessionOf({ goal: 'Retry webhook delivery with backoff', isFailed: true });
    const quiet = sessionOf({ goal: 'Add idempotency keys to the refund endpoint' });
    const sessions = [asking, failing, quiet];
    seed({
      sessions,
      questions: [
        questionOf({ session: asking, text: 'Keep the retry window at five minutes?', minute: 1 }),
      ],
    });
    railCounts.length = 0;
    mountBoard(sessions);

    expect(cards()).toHaveLength(2);
    expect(railCounts.at(-1)).toBe(2);
    within(runningLane()).getByText('2');
  });

  it('puts the yellow cards at the top of Running and the blue running cards below them', () => {
    const asking = sessionOf({ goal: 'Fix the rounding drift in the settlement export' });
    const working = sessionOf({ goal: 'Speed up the payout export', isRunning: true });
    seed({
      sessions: [asking, working],
      questions: [
        questionOf({ session: asking, text: 'Keep the retry window at five minutes?', minute: 1 }),
      ],
    });
    mountBoard([asking, working]);

    const lane = runningLane();
    const waiting = cardAt({ index: 0 });
    const running = within(lane).getByText(working.goal).closest('article');
    if (running === null) {
      throw new Error('the running session has no card in Running');
    }
    expect(waiting.compareDocumentPosition(running) & FOLLOWING).toBe(FOLLOWING);
    expect(within(frameAt({ index: 0 })).getByTestId('tone-bar').dataset.tone).toBe('warning');
    expect(within(running).getByTestId('tone-bar').dataset.tone).toBe('info');
    within(lane).getByText('2');
  });

  it('keeps a failing session yellow, since yellow means it needs you', () => {
    const failing = sessionOf({ goal: 'Retry webhook delivery with backoff', isFailed: true });
    seed({ sessions: [failing] });
    mountBoard([failing]);

    expect(within(frameAt({ index: 0 })).getByTestId('tone-bar').dataset.tone).toBe('warning');
  });

  it('gives a session with two open questions one card that says 2 questions', () => {
    const asking = sessionOf({ goal: 'Fix the rounding drift in the settlement export' });
    seed({
      sessions: [asking],
      questions: [
        questionOf({ session: asking, text: 'Keep the retry window at five minutes?', minute: 1 }),
        questionOf({ session: asking, text: 'Round half up or half even?', minute: 2 }),
      ],
    });
    mountBoard([asking]);

    expect(cards()).toHaveLength(1);
    expect(cards()[0]?.getAttribute('aria-label')).toBe(
      `Open ${asking.goal}, Keep the retry window at five minutes?`,
    );
    within(frameAt({ index: 0 })).getByText(/2 questions/);
  });

  it('reads like a lane card: repository and branch, title, then the wait and the question on one meta line', () => {
    const asking = sessionOf({ goal: 'Fix the rounding drift in the settlement export' });
    seed({
      sessions: [asking],
      questions: [
        questionOf({ session: asking, text: 'Keep the retry window at five minutes?', minute: 1 }),
      ],
    });
    useAppStore.setState({
      sessionProjectMounts: { [asking.id]: [mountOf({ session: asking, project })] },
    });
    mountBoard([asking]);

    const frame = frameAt({ index: 0 });
    const context = within(frame).getByText(`ledger-core · goodboy/${asking.id}`);
    expect(context.getAttribute('data-slot')).toBe('card-context');
    const title = within(frame).getByText(asking.goal);
    const facts = within(frame).getByText(
      /^Waiting \d+[a-z]+ · Keep the retry window at five minutes\?$/,
    );
    expect(facts.getAttribute('data-slot')).toBe('card-facts');
    expect(facts.className).toContain('line-clamp-2');
    expect(facts.className).not.toMatch(/(^|\s)truncate(\s|$)/);
    expect(context.compareDocumentPosition(title) & FOLLOWING).toBe(FOLLOWING);
    expect(title.compareDocumentPosition(facts) & FOLLOWING).toBe(FOLLOWING);
  });

  it('draws no yellow card and leaves Running empty when nothing needs you', () => {
    const quiet = sessionOf({ goal: 'Add idempotency keys to the refund endpoint' });
    seed({ sessions: [quiet] });
    mountBoard([quiet]);

    expect(cards()).toHaveLength(0);
    expect(runningLane().querySelector('[data-slot="lane-empty"]')).not.toBeNull();
  });

  it('resolves nothing on the card: no answer field, no choice, no send', () => {
    const asking = sessionOf({ goal: 'Fix the rounding drift in the settlement export' });
    seed({
      sessions: [asking],
      questions: [
        questionOf({ session: asking, text: 'Keep the retry window at five minutes?', minute: 1 }),
      ],
    });
    mountBoard([asking]);

    const frame = frameAt({ index: 0 });
    expect(within(frame).queryByRole('textbox')).toBeNull();
    expect(within(frame).queryByRole('button', { name: 'Keep five minutes' })).toBeNull();
    expect(within(frame).queryByRole('button', { name: /^Send/ })).toBeNull();
    expect(within(frame).queryByRole('button', { name: /Not now/ })).toBeNull();
    expect(within(frame).getAllByRole('button')).toHaveLength(1);
  });

  it('opens a question card at its question', async () => {
    const asking = sessionOf({ goal: 'Fix the rounding drift in the settlement export' });
    const question = questionOf({
      session: asking,
      text: 'Keep the retry window at five minutes?',
      minute: 1,
    });
    seed({ sessions: [asking], questions: [question] });
    mountBoard([asking]);

    fireEvent.click(cardAt({ index: 0 }));

    await waitFor(() =>
      expect(currentPlace()).toMatchObject({
        sessionId: asking.id,
        view: { lens: 'questions', target: { kind: 'question', questionId: question.id } },
      }),
    );
  });

  it('opens the question the card shows when the newer question is stored first', async () => {
    const asking = sessionOf({ goal: 'Fix the rounding drift in the settlement export' });
    const older = questionOf({ session: asking, text: 'Round half up or half even?', minute: 1 });
    const newer = questionOf({
      session: asking,
      text: 'Keep the retry window at five minutes?',
      minute: 2,
    });
    seed({ sessions: [asking], questions: [newer, older] });
    mountBoard([asking]);

    expect(cardAt({ index: 0 }).getAttribute('aria-label')).toBe(
      `Open ${asking.goal}, ${older.text}`,
    );
    fireEvent.click(cardAt({ index: 0 }));

    await waitFor(() =>
      expect(currentPlace()).toMatchObject({
        view: { lens: 'questions', target: { kind: 'question', questionId: older.id } },
      }),
    );
  });

  it('shows and opens the next waiting question when the older one is staged', async () => {
    const asking = sessionOf({ goal: 'Fix the rounding drift in the settlement export' });
    const older = questionOf({ session: asking, text: 'Round half up or half even?', minute: 1 });
    const newer = questionOf({
      session: asking,
      text: 'Keep the retry window at five minutes?',
      minute: 2,
    });
    seed({ sessions: [asking], questions: [older, newer] });
    useOpenQuestions.setState({ staged: [older.id] });
    mountBoard([asking]);

    expect(cardAt({ index: 0 }).getAttribute('aria-label')).toBe(
      `Open ${asking.goal}, ${newer.text}`,
    );
    fireEvent.click(cardAt({ index: 0 }));

    await waitFor(() =>
      expect(currentPlace()).toMatchObject({
        view: { lens: 'questions', target: { kind: 'question', questionId: newer.id } },
      }),
    );
  });

  it('carries the shown question through the attention channel to the other window', async () => {
    const asking = sessionOf({ goal: 'Fix the rounding drift in the settlement export' });
    const older = questionOf({ session: asking, text: 'Round half up or half even?', minute: 1 });
    const newer = questionOf({
      session: asking,
      text: 'Keep the retry window at five minutes?',
      minute: 2,
    });
    seed({ sessions: [asking], questions: [newer, older] });
    useAppStore.setState({
      currentWorkspaceId: northwind.id,
      openWorkspace: vi.fn(async () => ({ kind: 'opened' as const })),
    });
    mountBoard([asking]);

    fireEvent.click(cardAt({ index: 0 }));

    await waitFor(() =>
      expect(
        attentionTargetChannel.take({ workspaceId: workspace.id, now: Date.now() }),
      ).toMatchObject({ sessionId: asking.id, questionId: older.id }),
    );
  });

  it('counts a yellow card of a filtered out project as shown, not hidden', () => {
    const relay = aProject({ workspaceId: workspace.id, name: 'notify-relay', kind: 'folder' });
    const asking = sessionOf({ goal: 'Fix the rounding drift in the settlement export' });
    const quiet = sessionOf({ goal: 'Add idempotency keys to the refund endpoint' });
    seed({
      sessions: [asking, quiet],
      questions: [
        questionOf({ session: asking, text: 'Keep the retry window at five minutes?', minute: 1 }),
      ],
    });
    useAppStore.setState({
      projects: [project, relay],
      sessionProjectMounts: {
        [asking.id]: [mountOf({ session: asking, project })],
        [quiet.id]: [mountOf({ session: quiet, project: relay })],
      },
    });
    useAppStore.getState().setSelectedProjectIds({
      workspaceId: workspace.id,
      selectedProjectIds: [relay.id],
    });
    mountBoard([asking, quiet]);

    expect(cards()).toHaveLength(1);
    expect(screen.queryByText(/hidden$/)).toBeNull();
    expect(screen.queryByText(/in other projects$/)).toBeNull();
  });

  it('opens a failed card at the agent that failed', async () => {
    const failing = sessionOf({ goal: 'Retry webhook delivery with backoff', isFailed: true });
    const failed = anAgent({ sessionId: failing.id, status: 'failed' });
    seed({ sessions: [failing] });
    useAppStore.setState({ sessionPhaseRuns: { [failing.id]: [failed] } });
    mountBoard([failing]);

    fireEvent.click(cardAt({ index: 0 }));

    await waitFor(() =>
      expect(currentPlace()).toMatchObject({
        sessionId: failing.id,
        view: { agentId: failed.id },
      }),
    );
  });

  it('sends a card of a workspace that is not on screen through the attention channel', async () => {
    const asking = sessionOf({ goal: 'Fix the rounding drift in the settlement export' });
    seed({
      sessions: [asking],
      questions: [
        questionOf({ session: asking, text: 'Keep the retry window at five minutes?', minute: 1 }),
      ],
    });
    const openWorkspace = vi.fn(async () => ({ kind: 'opened' as const }));
    useAppStore.setState({ currentWorkspaceId: northwind.id, openWorkspace });
    const send = vi.spyOn(attentionTargetChannel, 'send').mockResolvedValue(undefined);
    mountBoard([asking]);

    fireEvent.click(cardAt({ index: 0 }));

    await waitFor(() =>
      expect(send).toHaveBeenCalledWith({
        target: expect.objectContaining({
          workspaceId: workspace.id,
          sessionId: asking.id,
          reason: 'open-question',
        }),
      }),
    );
    await waitFor(() =>
      expect(openWorkspace).toHaveBeenCalledWith(expect.objectContaining({ id: workspace.id })),
    );
  });

  it('says why when a card of another workspace cannot open', async () => {
    const asking = sessionOf({ goal: 'Fix the rounding drift in the settlement export' });
    seed({
      sessions: [asking],
      questions: [
        questionOf({ session: asking, text: 'Keep the retry window at five minutes?', minute: 1 }),
      ],
    });
    const reportError = vi.fn(async () => undefined);
    useAppStore.setState({ currentWorkspaceId: northwind.id, reportError });
    vi.spyOn(attentionTargetChannel, 'send').mockRejectedValue(new Error('channel closed'));
    mountBoard([asking]);

    fireEvent.click(cardAt({ index: 0 }));

    await waitFor(() =>
      expect(reportError).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Couldn't open this session" }),
      ),
    );
  });

  it('never shows the retired routing words', () => {
    const asking = sessionOf({ goal: 'Fix the rounding drift in the settlement export' });
    seed({
      sessions: [asking],
      questions: [
        questionOf({ session: asking, text: 'Keep the retry window at five minutes?', minute: 1 }),
      ],
    });
    mountBoard([asking]);

    const text = document.body.textContent ?? '';
    for (const word of ROUTING_WORDS) {
      expect(text).not.toContain(word);
    }
  });
});
