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
import type { IsoDateTime, PullRequestState, SessionExternalTask, SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import {
  ledgerCore,
  paymentsApi,
  renderBar,
  runningState,
  seedColumn,
  sessionOf,
} from '../../testing/sessionColumn';

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
  sessionId: webhook.id as SessionId,
  provider: 'linear',
  externalId: 'lin-212',
  identifier: 'HBL-212',
  url: 'https://linear.app/harborline/issue/HBL-212',
  title: 'Webhook retries post twice',
  createdAt: '2026-10-01T09:00:00.000Z' as IsoDateTime,
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
        anAgent({ sessionId: webhook.id as SessionId, name: 'Planner', status: 'completed' }),
        anAgent({
          sessionId: webhook.id as SessionId,
          name: 'Implementer',
          status: 'running',
          ordinal: 1,
        }),
      ],
    },
  });
  return renderBar();
};

const rowOf = (title: string) => screen.getByRole('button', { name: title });

const rest = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

const card = () => screen.queryByTestId('session-hover-card');

describe('the hover card', () => {
  it('opens after the pointer rests on a row for half a second', () => {
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
    act(() => rowOf('Fix webhook retries').focus());
    rest(499);
    expect(card()).toBeNull();
    rest(1);
    expect(within(card() as HTMLElement).getByText('Fix webhook retries')).toBeDefined();
  });

  it('swaps to the next row at once, with no second wait', () => {
    mount();
    fireEvent.mouseEnter(rowOf('Fix webhook retries'));
    rest(500);
    expect(within(card() as HTMLElement).getByText('Fix webhook retries')).toBeDefined();
    fireEvent.mouseLeave(rowOf('Fix webhook retries'));
    fireEvent.mouseEnter(rowOf('Retry policy for 429s'));
    expect(within(card() as HTMLElement).getByText('Retry policy for 429s')).toBeDefined();
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
    fireEvent.mouseEnter(card() as HTMLElement);
    rest(1000);
    expect(card()).not.toBeNull();
  });

  it('closes when the session opens', () => {
    mount();
    fireEvent.mouseEnter(rowOf('Fix webhook retries'));
    rest(500);
    fireEvent.click(rowOf('Fix webhook retries'));
    expect(card()).toBeNull();
  });
});

describe('what the hover card says', () => {
  const openCard = (title: string) => {
    mount();
    fireEvent.mouseEnter(rowOf(title));
    rest(500);
    return within(card() as HTMLElement);
  };

  it('names the stage and the reason of a session that needs you', () => {
    const view = openCard('Retry policy for 429s');
    expect(view.getByText('Needs you · 1 open question')).toBeDefined();
  });

  it('agrees with what the row tells a screen reader', () => {
    mount();
    const described = rowOf('Retry policy for 429s').getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(described)?.textContent ?? '').toMatch(/needs you/i);
    fireEvent.mouseEnter(rowOf('Retry policy for 429s'));
    rest(500);
    expect(within(card() as HTMLElement).getByText(/^Needs you/)).toBeDefined();
  });

  it('shows the pull request, its checks, the linked task and the project', () => {
    const view = openCard('Fix webhook retries');
    expect(view.getByText('#318 Draft · checks passing')).toBeDefined();
    expect(view.getByText('payments-api')).toBeDefined();
    expect(view.getByText('HBL-212')).toBeDefined();
  });

  it('counts the agents and says when the session last moved', () => {
    const view = openCard('Fix webhook retries');
    expect(view.getByText(/^2 agents/)).toBeDefined();
    expect(view.getByText(/5m ago$/)).toBeDefined();
  });

  it('offers to open what needs you, and lands on the questions', () => {
    const view = openCard('Retry policy for 429s');
    fireEvent.click(view.getByRole('button', { name: 'Open what needs you' }));
    expect(useAppStore.getState().activeLens[retry.id]).toBe('questions');
    expect(card()).toBeNull();
  });

  it('offers no action for a session that needs nothing', () => {
    const view = openCard('Fix webhook retries');
    expect(view.queryByRole('button', { name: 'Open what needs you' })).toBeNull();
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
    expect(within(card() as HTMLElement).getByText('Archived')).toBeDefined();
  });
});
