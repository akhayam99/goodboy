// @vitest-environment happy-dom
vi.hoisted(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-18T10:31:00.000Z'));
});
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { brandId, type IsoDateTime } from '@goodboy/types';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../test/fakeResizeObserver';
import { sceneInvoke, clearSceneInvoke } from '../../../../test/sceneInvoke';
import { resetWorktreeStatusCache } from '../../../../store/slices/worktreeStatuses/cache';
import { AutoReleaseContext } from '../../../auto/autoReleaseContext';
import { registerTreeStopPort } from '../../../auto/treeStopPort';
import {
  COLUMN_SESSION_ID,
  seedCentralColumn,
  type ColumnKind,
} from '../../../../app/components/MockScene/scenes/u26/centralColumnSeed';

let useAppStore: Awaited<ReturnType<typeof importStore>>;
let SessionOverviewPane: typeof import('./index').SessionOverviewPane;

beforeAll(async () => {
  installFakeResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
  useAppStore = await importStore();
  ({ SessionOverviewPane } = await import('./index'));
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  resetWorktreeStatusCache();
  clearSceneInvoke();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
});

afterEach(() => {
  cleanup();
});

const mountedSession = () => {
  const session = useAppStore
    .getState()
    .sessions.find((candidate) => candidate.id === COLUMN_SESSION_ID);
  if (session === undefined) {
    throw new Error('The seed must hold the session');
  }
  return session;
};

const settle = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

type KindParams = {
  readonly kind: ColumnKind;
};

const showColumn = async ({ kind }: KindParams) => {
  seedCentralColumn({ kind });
  const view = render(
    <ToastProvider>
      <AutoReleaseContext.Provider value>
        <SessionOverviewPane session={mountedSession()} />
      </AutoReleaseContext.Provider>
    </ToastProvider>,
  );
  await settle();
  return view;
};

type Facts = {
  readonly cards: ReadonlyArray<string>;
  readonly primary: string | null;
  readonly done: string | null;
};

const factsOf = (): Facts => {
  const primaries = document.querySelectorAll('[data-central-column] [data-variant="primary"]');
  expect(primaries.length).toBeLessThanOrEqual(1);
  return {
    cards: [...document.querySelectorAll('[data-overview-card]')].map(
      (card) => card.getAttribute('data-overview-card') ?? '',
    ),
    primary: primaries[0]?.textContent ?? null,
    done: document.querySelector('[data-done-line]')?.textContent ?? null,
  };
};

type Case = {
  readonly kind: ColumnKind;
  readonly facts: Facts;
};

const CASES: ReadonlyArray<Case> = [
  {
    kind: 'mid',
    facts: {
      cards: ['running', 'next', 'branches', 'done'],
      primary: 'Answer',
      done: '4 finished runs and agents are in the full log.',
    },
  },
  {
    kind: 'finished',
    facts: {
      cards: ['next', 'branches', 'done'],
      primary: 'Mark ready',
      done: '5 finished runs and agents are in the full log.',
    },
  },
  {
    kind: 'stuck',
    facts: {
      cards: ['needs-you', 'running', 'branches', 'done'],
      primary: 'Retry',
      done: '3 finished runs and agents are in the full log.',
    },
  },
  {
    kind: 'orchestrated',
    facts: {
      cards: ['running', 'branches', 'done'],
      primary: null,
      done: '4 finished runs and agents are in the full log.',
    },
  },
  {
    kind: 'agent',
    facts: {
      cards: ['needs-you', 'running', 'branches', 'done'],
      primary: 'Review',
      done: '3 finished runs and agents are in the full log.',
    },
  },
  {
    kind: 'branches',
    facts: {
      cards: ['running', 'next', 'branches', 'done'],
      primary: 'Answer',
      done: '4 finished runs and agents are in the full log.',
    },
  },
];

describe('the central column, kind by kind', () => {
  it.each(CASES)(
    '$kind: the cards in order, the one filled button and the done line',
    async ({ kind, facts }) => {
      await showColumn({ kind });

      expect(factsOf()).toEqual(facts);
    },
  );

  it('draws the cards Needs you, Running, Next, Branches, Done, with no Now and no Activity', async () => {
    const { container } = await showColumn({ kind: 'mid' });

    const column = container.querySelector('[data-central-column]');
    const ids = [...(column?.querySelectorAll(':scope > [data-overview-card]') ?? [])].map((card) =>
      card.getAttribute('data-overview-card'),
    );
    const order = ['needs-you', 'running', 'next', 'branches', 'done'];
    expect(ids.length).toBeGreaterThan(0);
    expect(
      [...ids].sort((first, second) => order.indexOf(first ?? '') - order.indexOf(second ?? '')),
    ).toEqual(ids);
    expect(screen.queryByRole('region', { name: 'Activity' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Now' })).toBeNull();
    expect(document.querySelector('[data-now-sentence]')).toBeNull();
  });

  it('counts the Needs you rows in its own header', async () => {
    await showColumn({ kind: 'agent' });

    const card = screen.getByRole('region', { name: 'Needs you' });
    const rows = card.querySelectorAll('[data-action-card]').length;
    expect(card.querySelector('[data-overview-count]')?.textContent).toBe(String(rows));
  });

  it('gives every running row one Where cell, with the project only across two projects', async () => {
    const { unmount } = await showColumn({ kind: 'mid' });
    const wheres = () =>
      [...document.querySelectorAll('[data-overview-card="running"] [data-live-row]')].map((row) =>
        [...row.querySelectorAll('[data-live-where]')].map((cell) => cell.textContent),
      );
    expect(wheres().every((cells) => cells.length === 1)).toBe(true);
    expect(
      wheres()
        .flat()
        .some((where) => (where ?? '').includes(' · ')),
    ).toBe(false);
    expect(
      document.querySelector('[data-overview-card="running"] [data-testid="branch-chip"]'),
    ).toBeNull();
    unmount();

    await showColumn({ kind: 'branches' });
    expect(wheres().flat()).toContain('ledger-core · ak/eng-1190-ledger-limits');
  });

  it('keeps only the Done card on an archived session', async () => {
    seedCentralColumn({ kind: 'mid' });
    useAppStore.setState((state) => ({
      sessions: state.sessions.map((session) => ({
        ...session,
        archivedAt: brandId<IsoDateTime>({ value: '2026-10-18T10:00:00.000Z' }),
      })),
    }));
    render(
      <ToastProvider>
        <SessionOverviewPane session={mountedSession()} />
      </ToastProvider>,
    );
    await settle();

    const ids = [...document.querySelectorAll('[data-overview-card]')].map((card) =>
      card.getAttribute('data-overview-card'),
    );
    expect(ids).toEqual(['done']);
    screen.getByRole('button', { name: 'Full log' });
  });
});

const STUCK_TITLE = 'Fix the two doc mismatches in ledger-core';
const RETRY_NAME = `Retry "${STUCK_TITLE}"`;

type StuckSpies = {
  readonly retry: ReturnType<typeof vi.fn>;
  readonly navigate: ReturnType<typeof vi.fn>;
};

const showStuck = async (): Promise<StuckSpies> => {
  await showColumn({ kind: 'stuck' });
  const retry = vi.fn(async () => undefined);
  const navigate = vi.fn();
  act(() => {
    useAppStore.setState({
      continueStoppedAgent: retry,
      loadAutoTrees: vi.fn(async () => undefined),
      navigate,
    });
  });
  await settle();
  return { retry, navigate };
};

const stuckLine = () => {
  const line = document.querySelector<HTMLElement>('[data-now-actions]');
  if (line === null) {
    throw new Error('The stuck line must be drawn');
  }
  return within(line);
};

const stuckView = () => {
  const [view] = useAppStore.getState().autoTreeViews[COLUMN_SESSION_ID] ?? [];
  if (view === undefined) {
    throw new Error('The stuck seed must hold an Auto tree');
  }
  return view;
};

const pressRetry = async () => {
  await act(async () => {
    fireEvent.click(stuckLine().getByRole('button', { name: RETRY_NAME }));
  });
};

describe('the stuck line in Running', () => {
  afterEach(() => {
    registerTreeStopPort({ port: null });
  });

  it('draws no line while nothing is stuck', async () => {
    await showColumn({ kind: 'mid' });

    expect(document.querySelector('[data-now-actions]')).toBeNull();
  });

  it('offers Retry with the quoted title, Answer and Stop under the sentence', async () => {
    await showStuck();
    const line = stuckLine();

    expect(line.getByRole('button', { name: RETRY_NAME }).textContent).toBe('Retry');
    line.getByRole('button', { name: 'Answer Auto in its chat' });
    line.getByRole('button', { name: 'Stop Auto and its agents' });
  });

  it('retries the stuck child on the Next card path, naming the child', async () => {
    const { retry } = await showStuck();

    await pressRetry();

    expect(retry).toHaveBeenCalledTimes(1);
    expect(retry.mock.calls[0]?.[0]).toMatchObject({ sessionId: COLUMN_SESSION_ID });
  });

  it('keeps the line on a failed retry, says why, and a second Retry tries again', async () => {
    const { retry } = await showStuck();
    retry.mockRejectedValueOnce(new Error('Auto is not running yet.'));

    await pressRetry();

    expect(stuckLine().getByRole('alert').textContent).toBe('Auto is not running yet.');
    expect(screen.getByRole('region', { name: 'Needs you' }).textContent).toContain(
      'Auto is not running yet.',
    );

    await pressRetry();

    expect(retry).toHaveBeenCalledTimes(2);
    expect(stuckLine().queryByRole('alert')).toBeNull();
  });

  it('opens the Auto chat from Answer', async () => {
    const { navigate } = await showStuck();

    fireEvent.click(stuckLine().getByRole('button', { name: 'Answer Auto in its chat' }));

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(navigate.mock.calls[0])).toContain(stuckView().tree.rootAgentId);
  });

  it('stops the tree it names and says why when agents keep running', async () => {
    await showStuck();
    const stop = vi.fn(async () => 'stuck' as const);
    registerTreeStopPort({ port: stop });

    await act(async () => {
      fireEvent.click(stuckLine().getByRole('button', { name: 'Stop Auto and its agents' }));
    });

    expect(stop).toHaveBeenCalledWith({ treeId: stuckView().tree.id });
    expect(stuckLine().getByRole('alert').textContent).toBe(
      "Couldn't stop the Auto agents. Some agents are still running. Press Stop again to retry.",
    );
  });
});
