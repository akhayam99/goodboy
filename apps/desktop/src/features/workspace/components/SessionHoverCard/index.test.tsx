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
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { anAgent } from '@goodboy/types/testing';
import { brandId } from '@goodboy/types';
import type { IsoDateTime, PullRequestState, SessionExternalTask, SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../store/storyHarness';
import {
  ledgerCore,
  openQuestionFor,
  paymentsApi,
  renderBoard,
  runningState,
  seedColumn,
  sessionOf,
} from '../../testing/sessionColumn';
import { FLEET_EVERY_MS } from '../../hooks/useFleetPhrase';

type LiveParams = {
  readonly command: string;
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-06T10:00:00.000Z'));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const retry = sessionOf({
  goal: 'Retry policy for 429s',
  updatedAt: '2026-10-06T09:48:00.000Z',
  lastOpenedAt: '2026-10-06T09:00:00.000Z',
});
const webhook = sessionOf({
  goal: 'Fix webhook retries',
  state: runningState(),
  updatedAt: '2026-10-06T09:55:00.000Z',
  lastOpenedAt: '2026-10-06T08:00:00.000Z',
});
const archivedOne = sessionOf({ goal: 'Legacy hook cleanup' });

const draftPr = (): PullRequestState => ({
  number: 318,
  title: 'Retry webhooks with backoff',
  url: 'https://github.com/harborline/payments-api/pull/318',
  state: 'draft',
  mergeable: null,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'goodboy/webhook-retries',
  isDraft: true,
  reviewDecision: null,
  body: '',
  updatedAt: '2026-10-06T09:00:00.000Z',
});

const task: SessionExternalTask = {
  sessionId: brandId<SessionId>({ value: webhook.id }),
  provider: 'linear',
  externalId: 'lin-212',
  identifier: 'HBL-212',
  url: 'https://linear.app/harborline/issue/HBL-212',
  title: 'Webhook retries post twice',
  createdAt: brandId<IsoDateTime>({ value: '2026-10-01T09:00:00.000Z' }),
};

const mount = () => {
  seedColumn({
    store: useAppStore,
    sessions: [retry, webhook],
    archived: [archivedOne],
    questions: [retry],
    mounts: [
      [webhook, paymentsApi],
      [retry, ledgerCore],
    ],
  });
  useAppStore.setState({
    sessionGithub: {
      [webhook.id]: {
        pr: draftPr(),
        linkedIssues: [],
        fetchedAt: null,
        failedAt: null,
        loading: false,
        error: null,
        detail: null,
        detailFetchedAt: null,
        detailLoading: false,
        detailError: null,
      },
    },
    sessionExternalTasks: { [webhook.id]: [task] },
    sessionPhaseRuns: {
      [webhook.id]: [
        anAgent({
          sessionId: brandId<SessionId>({ value: webhook.id }),
          name: 'Planner',
          status: 'completed',
        }),
        anAgent({
          sessionId: brandId<SessionId>({ value: webhook.id }),
          name: 'Implementer',
          status: 'running',
          ordinal: 1,
        }),
      ],
    },
  });
  return renderBoard({ store: useAppStore });
};

const buttonOf = (title: string): HTMLElement => screen.getByRole('button', { name: title });

const rowOf = (title: string): HTMLElement => {
  const card = buttonOf(title).closest('article');
  if (card === null) {
    throw new Error(`no board card for ${title}`);
  }
  return card;
};

const rest = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

const card = () => screen.queryByTestId('session-hover-card');

describe('the hover card', () => {
  it('opens after the pointer rests on a board card for half a second', () => {
    mount();
    fireEvent.mouseEnter(rowOf('Fix webhook retries'));
    rest(499);
    expect(card()).toBeNull();
    rest(1);
    expect(card()).not.toBeNull();
  });

  it('does not open when the pointer passes over a row', () => {
    mount();
    fireEvent.mouseEnter(rowOf('Fix webhook retries'));
    rest(300);
    fireEvent.mouseLeave(rowOf('Fix webhook retries'));
    rest(1000);
    expect(card()).toBeNull();
  });

  it('opens when a row takes the keyboard focus, after the same rest', () => {
    mount();
    act(() => buttonOf('Fix webhook retries').focus());
    rest(499);
    expect(card()).toBeNull();
    rest(1);
    within(screen.getByTestId('session-hover-card')).getByText('Fix webhook retries');
  });

  it('swaps to the next row at once, with no second wait', () => {
    mount();
    fireEvent.mouseEnter(rowOf('Fix webhook retries'));
    rest(500);
    within(screen.getByTestId('session-hover-card')).getByText('Fix webhook retries');
    fireEvent.mouseLeave(rowOf('Fix webhook retries'));
    fireEvent.mouseEnter(rowOf('Retry policy for 429s'));
    within(screen.getByTestId('session-hover-card')).getByText('Retry policy for 429s');
  });

  it('closes on Escape', () => {
    mount();
    fireEvent.mouseEnter(rowOf('Fix webhook retries'));
    rest(500);
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(card()).toBeNull();
  });

  it('closes a moment after the pointer leaves the list', () => {
    mount();
    fireEvent.mouseEnter(rowOf('Fix webhook retries'));
    rest(500);
    fireEvent.mouseLeave(rowOf('Fix webhook retries'));
    rest(200);
    expect(card()).toBeNull();
  });

  it('stays open while the pointer is on the card', () => {
    mount();
    fireEvent.mouseEnter(rowOf('Fix webhook retries'));
    rest(500);
    fireEvent.mouseLeave(rowOf('Fix webhook retries'));
    fireEvent.mouseEnter(screen.getByTestId('session-hover-card'));
    rest(1000);
    expect(card()).not.toBeNull();
  });
});

describe('what the hover card says', () => {
  const openCard = (title: string) => {
    mount();
    fireEvent.mouseEnter(rowOf(title));
    rest(500);
    return within(screen.getByTestId('session-hover-card'));
  };

  it.each(['Retry policy for 429s'])('draws the same mark as the board card of %s', (title) => {
    mount();
    const markOf = (scope: HTMLElement) => {
      const box = scope.querySelector('[data-status-mark]');
      return [box?.getAttribute('data-status-mark'), box?.getAttribute('data-status-state')];
    };
    const row = markOf(rowOf(title));
    fireEvent.mouseEnter(rowOf(title));
    rest(500);
    expect(markOf(screen.getByTestId('session-hover-card'))).toEqual(row);
    expect(row[0]).toBe('state');
  });

  it('says what waits on you in the words of the reason table', () => {
    const view = openCard('Retry policy for 429s');
    view.getByText('1 question for you');
  });

  it('agrees with what the board card tells a screen reader', () => {
    mount();
    const described = buttonOf('Retry policy for 429s').getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(described)?.textContent ?? '').toBe('1 question for you');
    fireEvent.mouseEnter(rowOf('Retry policy for 429s'));
    rest(500);
    within(screen.getByTestId('session-hover-card')).getByText('1 question for you');
  });

  it('shows the pull request, its checks, the linked task and the project', () => {
    const view = openCard('Fix webhook retries');
    view.getByText('#318 Draft · checks passing');
    view.getByText('payments-api');
    view.getByText('HBL-212');
  });

  it('counts the agents and says when the session last moved', () => {
    const view = openCard('Fix webhook retries');
    view.getByText(/^2 agents/);
    view.getByText(/5m ago$/);
  });

  const failingApproved = (): PullRequestState => ({
    ...draftPr(),
    state: 'approved',
    isDraft: false,
    reviewDecision: 'approved',
    checks: 'failure',
  });

  const seedGithubFor = ({
    session,
    pr,
  }: {
    readonly session: typeof retry;
    readonly pr: PullRequestState;
  }) => {
    const current = useAppStore.getState().sessionGithub;
    const template = current[webhook.id];
    if (template === undefined) {
      throw new Error('the webhook seed has no pull request');
    }
    useAppStore.setState({ sessionGithub: { ...current, [session.id]: { ...template, pr } } });
  };

  it('lists the facts behind the winner, each on its own line', () => {
    mount();
    seedGithubFor({ session: retry, pr: failingApproved() });
    fireEvent.mouseEnter(rowOf('Retry policy for 429s'));
    rest(500);
    const view = within(screen.getByTestId('session-hover-card'));

    view.getByText('1 question for you');
    expect(view.getByText('Checks failing').getAttribute('data-attention-line')).toBe('ci-failed');
    expect(view.getByText('Approved, ready to merge').getAttribute('data-attention-line')).toBe(
      'pr-approved',
    );
  });

  const liveWorkFor = ({ command }: LiveParams) => {
    const base = storySpies.tauriInvoke.getMockImplementation();
    storySpies.tauriInvoke.mockImplementation(async (name, args) =>
      name === 'live_work'
        ? [
            {
              runId: 'run-webhook',
              sessionId: webhook.id,
              agentId: 'agent-webhook',
              mountId:
                useAppStore.getState().sessionProjectMounts[webhook.id]?.[0]?.mountId ?? null,
              startedAt: 1,
              tool: { name: 'Bash', command, path: null },
              hasToolCall: true,
              canSeeTools: true,
            },
          ]
        : base?.(name, args),
    );
  };

  const settle = async () => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FLEET_EVERY_MS);
    });
  };

  it('says what the agent is doing when a reason keeps a running session in needs you', async () => {
    mount();
    liveWorkFor({ command: 'pnpm test retry' });
    useAppStore.setState({
      sessionOpenQuestions: {
        ...useAppStore.getState().sessionOpenQuestions,
        [webhook.id]: [openQuestionFor({ sessionId: brandId<SessionId>({ value: webhook.id }) })],
      },
    });
    await settle();
    fireEvent.mouseEnter(rowOf('Fix webhook retries'));
    rest(500);
    const view = within(screen.getByTestId('session-hover-card'));

    view.getByText('1 question for you');
    view.getByText('Running pnpm test retry in payments-api');
    expect(view.queryByText('An agent is working')).toBeNull();
  });

  it('draws the phrase still, with no pulse and no motion', async () => {
    mount();
    liveWorkFor({ command: 'pnpm lint' });
    await settle();
    fireEvent.mouseEnter(rowOf('Fix webhook retries'));
    rest(500);
    const phrase = within(screen.getByTestId('session-hover-card')).getByText(
      'Running pnpm lint in payments-api',
    );
    const line = phrase.closest('div');

    expect(line?.innerHTML ?? '').not.toMatch(/animate-|pulsing|motion-safe:animate/);
  });

  it('lists what is wrong behind a running session without turning it into needs you', () => {
    mount();
    seedGithubFor({ session: webhook, pr: failingApproved() });
    fireEvent.mouseEnter(rowOf('Fix webhook retries'));
    rest(500);
    const view = within(screen.getByTestId('session-hover-card'));

    view.getByText('Running');
    view.getByText('Checks failing');
    view.getByText('Approved, ready to merge');
    expect(view.queryByText('An agent is working')).toBeNull();
  });

  it('says Archived for an archived session', () => {
    mount();
    act(() => {
      useAppStore.getState().setSessionViewPrefs({
        workspaceId: retry.workspaceId,
        patch: { isArchivedShown: true },
      });
    });
    fireEvent.mouseEnter(rowOf('Legacy hook cleanup'));
    rest(500);
    within(screen.getByTestId('session-hover-card')).getByText('Archived');
  });
});
