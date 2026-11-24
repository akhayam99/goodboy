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
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { attentionTargetChannel } from '../../../../session/attentionTargetChannel';
import { useOpenQuestions } from '../../../../context/components/QuestionsTab/useOpenQuestions';
import { stagesNavigationOf } from '../../../testing/stagesNavigationOf';
import { mountOf } from '../../../testing/sessionColumn';
import { boardLanesOf, rootRemPx } from '../boardLanesOf';
import { laneColumnsOf } from '../laneColumnsOf';
import { laneWidthOf } from '../laneWidthOf';
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
  Reflect.deleteProperty(HTMLElement.prototype, 'scrollWidth');
  Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth');
});

type SessionParams = {
  readonly goal: string;
  readonly isFailed?: boolean;
};

const sessionOf = ({ goal, isFailed = false }: SessionParams): Session =>
  aSession({
    workspaceId: workspace.id,
    goal,
    ...(isFailed && {
      state: { kind: 'error', message: 'provider gave up', failedAt: ERROR_AT },
    }),
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

const strip = (): HTMLElement => screen.getByRole('region', { name: 'Needs you' });

const cards = (): ReadonlyArray<HTMLElement> =>
  Array.from(strip().querySelectorAll<HTMLElement>('[data-needs-you-card]'));

type CardParams = {
  readonly index: number;
};

const cardAt = ({ index }: CardParams): HTMLElement => {
  const card = cards()[index];
  if (card === undefined) {
    throw new Error(`the strip has no card ${index}`);
  }
  return card;
};

const itemAt = ({ index }: CardParams): HTMLElement => {
  const item = cardAt({ index }).closest<HTMLElement>('[role="listitem"]');
  if (item === null) {
    throw new Error(`card ${index} sits in no list item`);
  }
  return item;
};

const stripViewport = (): HTMLElement => {
  const viewport = strip().querySelector('[class*="overflow-x-auto"]');
  if (!(viewport instanceof HTMLElement)) {
    throw new Error('the strip has no horizontal scroller');
  }
  return viewport;
};

type BoxParams = {
  readonly width: number;
};

const boxOf = ({ width }: BoxParams): DOMRect => new DOMRect(0, 0, width, 800);

type ExtentParams = {
  readonly scrollWidth: number;
  readonly clientWidth: number;
};

const stubExtent = ({ scrollWidth, clientWidth }: ExtentParams): void => {
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    get: () => scrollWidth,
  });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => clientWidth,
  });
};

const currentPlace = () => {
  const stack = useAppStore.getState().navigation[workspace.id];
  return stack?.entries[stack.index]?.place;
};

const REM_PATTERN = /(\d+(?:\.\d+)?)rem/;

const remOf = (value: string): number => Number(REM_PATTERN.exec(value)?.[1] ?? Number.NaN);

const ROUTING_WORDS = ['Balanced', 'In order', 'most room', 'Send new steps to'];

describe('NeedsYouStrip', () => {
  it('shows one card per counted session, the same count as the rail badge', () => {
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
    within(strip()).getByText('2');
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
    within(itemAt({ index: 0 })).getByText(/2 questions/);
  });

  it('draws no strip and no empty line when nothing needs you', () => {
    const quiet = sessionOf({ goal: 'Add idempotency keys to the refund endpoint' });
    seed({ sessions: [quiet] });
    mountBoard([quiet]);

    expect(screen.queryByRole('region', { name: 'Needs you' })).toBeNull();
    expect(screen.queryByText(/Nothing needs you/)).toBeNull();
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

    expect(within(strip()).queryByRole('textbox')).toBeNull();
    expect(within(strip()).queryByRole('button', { name: 'Keep five minutes' })).toBeNull();
    expect(within(strip()).queryByRole('button', { name: /^Send/ })).toBeNull();
    expect(within(strip()).queryByRole('button', { name: /Not now/ })).toBeNull();
    expect(within(strip()).getAllByRole('button')).toHaveLength(1);
  });

  it.each([[1200], [900], [700]])(
    'keeps each card as wide as one lane on a %ipx board',
    (width) => {
      const asking = sessionOf({ goal: 'Fix the rounding drift in the settlement export' });
      seed({
        sessions: [asking],
        questions: [
          questionOf({
            session: asking,
            text: 'Keep the retry window at five minutes?',
            minute: 1,
          }),
        ],
      });
      const observers = installFakeResizeObserver();
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(() =>
        boxOf({ width }),
      );
      mountBoard([asking]);
      act(() => observers.resizeAll());

      const remPx = rootRemPx();
      const laneRem = laneWidthOf({ width, remPx });
      const columns = laneColumnsOf({ layout: boardLanesOf({ width, remPx }), laneRem });
      const lanes = screen.getByRole('group', { name: 'building' }).parentElement;
      expect(lanes?.style.gridTemplateColumns).toBe(columns.style?.gridTemplateColumns ?? '');
      expect(remOf(itemAt({ index: 0 }).style.width)).toBe(laneRem);
    },
  );

  it('hides the scroll arrows while every card fits', () => {
    const asking = sessionOf({ goal: 'Fix the rounding drift in the settlement export' });
    seed({
      sessions: [asking],
      questions: [
        questionOf({ session: asking, text: 'Keep the retry window at five minutes?', minute: 1 }),
      ],
    });
    stubExtent({ scrollWidth: 600, clientWidth: 600 });
    mountBoard([asking]);

    expect(within(strip()).queryByRole('button', { name: 'Scroll left' })).toBeNull();
    expect(within(strip()).queryByRole('button', { name: 'Scroll right' })).toBeNull();
  });

  it('shows the scroll arrows when the cards overflow and scrolls one card per press', () => {
    const sessions = Array.from({ length: 6 }, (_, index) =>
      sessionOf({ goal: `Ship the settlement change ${index + 1}` }),
    );
    seed({
      sessions,
      questions: sessions.map((session, index) =>
        questionOf({ session, text: `Keep change ${index + 1} behind a flag?`, minute: index }),
      ),
    });
    stubExtent({ scrollWidth: 1800, clientWidth: 900 });
    mountBoard(sessions);

    const left = within(strip()).getByRole('button', { name: 'Scroll left' });
    const right = within(strip()).getByRole('button', { name: 'Scroll right' });
    expect(left.hasAttribute('disabled')).toBe(true);

    fireEvent.click(right);

    expect(stripViewport().scrollLeft).toBeGreaterThan(0);
    expect(
      within(strip()).getByRole('button', { name: 'Scroll left' }).hasAttribute('disabled'),
    ).toBe(false);
  });

  it('moves focus to the next card with ArrowRight and scrolls it into view', () => {
    const first = sessionOf({ goal: 'Fix the rounding drift in the settlement export' });
    const second = sessionOf({ goal: 'Retry webhook delivery with backoff' });
    seed({
      sessions: [first, second],
      questions: [
        questionOf({ session: first, text: 'Keep the retry window at five minutes?', minute: 1 }),
        questionOf({ session: second, text: 'Back off per tenant?', minute: 2 }),
      ],
    });
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    mountBoard([first, second]);

    const one = cardAt({ index: 0 });
    const two = cardAt({ index: 1 });
    one.focus();
    fireEvent.keyDown(one, { key: 'ArrowRight' });

    expect(document.activeElement).toBe(two);
    expect(scrolled.mock.contexts).toContain(two);
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

  it('counts a strip card of a filtered out project as shown, not hidden', () => {
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
