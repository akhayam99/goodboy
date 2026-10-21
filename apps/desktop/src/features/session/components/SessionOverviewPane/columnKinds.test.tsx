// @vitest-environment happy-dom
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
        <SessionOverviewPane session={mountedSession()} onSelectLens={vi.fn()} />
      </AutoReleaseContext.Provider>
    </ToastProvider>,
  );
  await settle();
  return view;
};

type Facts = {
  readonly state: string | null;
  readonly sentence: string | null;
  readonly primary: string | null;
  readonly doneTitle: string | null;
};

const factsOf = (): Facts => {
  const firstCard = document.querySelector('[data-action-card]');
  const done = screen.queryByRole('region', { name: 'What was done' });
  return {
    state: document.querySelector('[data-now-state]')?.getAttribute('data-now-state') ?? null,
    sentence: document.querySelector('[data-now-sentence]')?.textContent ?? null,
    primary: firstCard?.querySelector('[data-variant="primary"]')?.textContent ?? null,
    doneTitle: done?.querySelector('li .text-row')?.textContent ?? null,
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
      state: 'waiting',
      sentence:
        'Build step 3 waits on your answer. Auto is waiting for "Fix the two doc mismatches in ledger-core".',
      primary: 'Answer',
      doneTitle: 'Scoped the change and wrote the tests first',
    },
  },
  {
    kind: 'finished',
    facts: {
      state: 'done',
      sentence: 'Checks passed on #309. Still a draft.',
      primary: 'Mark ready',
      doneTitle: 'Fixed the failing static-analysis check',
    },
  },
  {
    kind: 'stuck',
    facts: {
      state: 'stuck',
      sentence: 'Auto is stuck: "Fix the two doc mismatches in ledger-core" never started.',
      primary: 'Retry',
      doneTitle: 'Summarised the plan',
    },
  },
  {
    kind: 'orchestrated',
    facts: {
      state: 'working',
      sentence: 'The orchestrator is deciding the next step.',
      primary: null,
      doneTitle: 'Build the limit table',
    },
  },
  {
    kind: 'agent',
    facts: {
      state: 'waiting',
      sentence: 'Implementer is working on Add the limit table.',
      primary: 'Review',
      doneTitle: 'Summarised the plan',
    },
  },
  {
    kind: 'branches',
    facts: {
      state: 'waiting',
      sentence: 'Build step 3 waits on your answer. Implementer is working on Add the limit table.',
      primary: 'Answer',
      doneTitle: 'Scoped the change and wrote the tests first',
    },
  },
];

const CHIP_SELECTOR = '[data-central-column] [data-testid="branch-chip"]';

describe('the central column, kind by kind', () => {
  it.each(CASES)(
    '$kind: state word, sentence, first primary and first done row',
    async ({ kind, facts }) => {
      await showColumn({ kind });

      expect(factsOf()).toEqual(facts);
    },
  );

  it('orders the column Now, Next, What was done, with no Activity or Needs you region', async () => {
    const { container } = await showColumn({ kind: 'mid' });

    const column = container.querySelector('[data-central-column]');
    const names = [...(column?.querySelectorAll(':scope > section') ?? [])].map((section) =>
      section.getAttribute('aria-label'),
    );
    expect(names).toEqual(['Now', 'Next steps', 'What was done']);
    expect(screen.queryByRole('region', { name: 'Activity' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Needs you' })).toBeNull();
  });

  it('scrolls to Next from the one count in the Now header', async () => {
    await showColumn({ kind: 'mid' });
    const scroll = vi.mocked(Element.prototype.scrollIntoView);
    scroll.mockClear();

    const count = within(screen.getByRole('region', { name: 'Now' })).getByRole('button', {
      name: /wait(s)? on you, go to Next$/,
    });
    fireEvent.click(count);

    expect(scroll).toHaveBeenCalledTimes(1);
    expect(scroll.mock.contexts[0]).toBe(screen.getByRole('region', { name: 'Next steps' }));
  });

  it('draws a branch chip only when the session has several branches', async () => {
    const { unmount } = await showColumn({ kind: 'mid' });
    expect(document.querySelector(CHIP_SELECTOR)).toBeNull();
    unmount();

    await showColumn({ kind: 'branches' });
    expect(document.querySelectorAll(CHIP_SELECTOR).length).toBeGreaterThan(0);
  });

  it('keeps What was done and drops Now and Next on an archived session', async () => {
    seedCentralColumn({ kind: 'mid' });
    useAppStore.setState((state) => ({
      sessions: state.sessions.map((session) => ({
        ...session,
        archivedAt: brandId<IsoDateTime>({ value: '2026-10-18T10:00:00.000Z' }),
      })),
    }));
    render(
      <ToastProvider>
        <SessionOverviewPane session={mountedSession()} onSelectLens={vi.fn()} />
      </ToastProvider>,
    );
    await settle();

    expect(screen.queryByRole('region', { name: 'Now' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Next steps' })).toBeNull();
    screen.getByRole('region', { name: 'What was done' });
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

describe('the stuck line in Now', () => {
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
    expect(screen.getByRole('region', { name: 'Next steps' }).textContent).toContain(
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
