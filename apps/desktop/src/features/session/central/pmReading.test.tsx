// @vitest-environment happy-dom
vi.hoisted(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 18, 10, 31, 0));
});

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);

import { readFileSync } from 'fs';
import { join } from 'path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { brandId, type IsoDateTime } from '@goodboy/types';
import { ToastProvider } from '../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../test/fakeResizeObserver';
import { sceneInvoke, clearSceneInvoke } from '../../../test/sceneInvoke';
import { resetWorktreeStatusCache } from '../../../store/runtime/worktreeStatuses/cache';
import { AutoReleaseContext } from '../../auto/autoReleaseContext';
import {
  COLUMN_SESSION_ID,
  seedCentralColumn,
  type ColumnKind,
} from '../../../app/components/MockScene/scenes/u26/centralColumnSeed';

let useAppStore: Awaited<ReturnType<typeof importStore>>;
let SessionOverviewPane: typeof import('../components/SessionOverviewPane').SessionOverviewPane;

beforeAll(async () => {
  installFakeResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
  useAppStore = await importStore();
  ({ SessionOverviewPane } = await import('../components/SessionOverviewPane'));
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

afterEach(cleanup);

afterAll(() => {
  vi.useRealTimers();
});

const DOC = join(__dirname, '..', '..', '..', '..', '..', '..', 'docs', 'features', 'overview.md');

const LEAD = '**Reading the task without a diff.**';

const NUMBERED = /^\d+\.\s+\*\*(.+?)\.\*\*/;

const acceptanceOf = (): ReadonlyArray<string> => {
  const text = readFileSync(DOC, 'utf8');
  const start = text.indexOf(LEAD);
  if (start === -1) {
    throw new Error('The overview doc has lost the PM acceptance list.');
  }
  const [section = ''] = text.slice(start).split(/\n<picture>|\n### /);
  return section
    .split('\n')
    .map((line) => NUMBERED.exec(line)?.[1])
    .filter((title): title is string => title !== undefined);
};

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

type ShowParams = {
  readonly kind: ColumnKind;
};

const mountPane = async () => {
  render(
    <ToastProvider>
      <AutoReleaseContext.Provider value>
        <SessionOverviewPane session={mountedSession()} />
      </AutoReleaseContext.Provider>
    </ToastProvider>,
  );
  await settle();
};

const show = async ({ kind }: ShowParams) => {
  seedCentralColumn({ kind });
  await mountPane();
};

const cardOf = ({ name }: { readonly name: string }) => screen.getByRole('region', { name });

const stateLine = () => {
  const line = document.querySelector<HTMLElement>('[data-summary-state]');
  if (line === null) {
    throw new Error('The state sentence must be drawn');
  }
  return line;
};

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

type SummaryAtParams = {
  readonly agoMs: number;
};

const writeSummaryAt = ({ agoMs }: SummaryAtParams) => {
  const createdAt = new Date(Date.now() - agoMs).toISOString();
  const state = useAppStore.getState();
  const entries = state.slotHistory[COLUMN_SESSION_ID]?.last_output_summary ?? [];
  act(() => {
    useAppStore.setState({
      slotHistory: {
        ...state.slotHistory,
        [COLUMN_SESSION_ID]: {
          last_output_summary: entries.map((entry) => ({
            ...entry,
            createdAt: brandId<IsoDateTime>({ value: createdAt }),
          })),
        },
      },
    });
  });
};

type Acceptance = {
  readonly title: string;
  readonly walk: () => Promise<void>;
};

const ACCEPTANCE: ReadonlyArray<Acceptance> = [
  {
    title: 'The goal',
    walk: async () => {
      await show({ kind: 'mid' });

      expect(document.querySelector('[data-overview-goal]')?.getAttribute('aria-label')).toContain(
        'Add per-tenant payout limits to payments-api',
      );
    },
  },
  {
    title: 'The state',
    walk: async () => {
      seedCentralColumn({ kind: 'mid' });
      writeSummaryAt({ agoMs: 2 * MINUTE_MS });
      await mountPane();

      const line = stateLine();
      expect(line.getAttribute('aria-label')).toBe(
        'State: Limits are enforced on payout creation and the retry fix waits on a review. Written 2m ago',
      );
      expect(line.getAttribute('data-stale')).toBe('false');
    },
  },
  {
    title: 'What waits for you',
    walk: async () => {
      await show({ kind: 'stuck' });

      const needsYou = cardOf({ name: 'Needs you' });
      expect(needsYou.textContent).toContain('Auto is stuck');
      expect(needsYou.textContent).toContain('The implementer never started');
    },
  },
  {
    title: 'What is at work',
    walk: async () => {
      await show({ kind: 'mid' });

      const run = within(cardOf({ name: 'Running' })).getByRole('region', {
        name: 'Workflow: Build',
      });
      expect(run.textContent).toContain('Step 3 of 6');
    },
  },
  {
    title: 'Where each branch stands',
    walk: async () => {
      await show({ kind: 'mid' });

      const branches = cardOf({ name: 'Branches' });
      expect(branches.textContent).toContain('ak/eng-1190-tenant-limits');
      expect(branches.textContent).toContain('Checks failing');
    },
  },
  {
    title: 'What finished',
    walk: async () => {
      await show({ kind: 'mid' });

      const done = cardOf({ name: 'Done' });
      expect(done.querySelector('[data-done-line]')?.textContent).toBe(
        '4 finished runs and agents are in the full log.',
      );
      within(done).getByRole('button', { name: 'Full log' });
    },
  },
];

describe('the PM reading of a task, as the overview doc lists it', () => {
  it('lists in the doc exactly the things this file walks, in order', () => {
    expect(acceptanceOf()).toEqual(ACCEPTANCE.map((item) => item.title));
  });

  it.each(ACCEPTANCE.map((item) => [item.title, item] as const))(
    'holds: %s',
    async (_title, item) => {
      await item.walk();
    },
  );

  it('needs no diff: the page draws no code block and no hunk', async () => {
    await show({ kind: 'mid' });

    expect(document.querySelector('pre, code')).toBeNull();
    expect(screen.queryByText(/^@@ /)).toBeNull();
  });
});

describe('the state sentence and its age', () => {
  it('greys when the summary is older than a day and says so', async () => {
    seedCentralColumn({ kind: 'mid' });
    writeSummaryAt({ agoMs: 2 * DAY_MS });
    act(() => {
      useAppStore.setState({ sessionGithub: {}, mountGithub: {} });
    });
    await mountPane();

    const line = stateLine();
    expect(line.getAttribute('data-stale')).toBe('old');
    expect(line.getAttribute('aria-label')).toContain('Written 2d ago, may be out of date');
  });

  it('lets the branch story win when a pull request moved after the summary', async () => {
    seedCentralColumn({ kind: 'mid' });
    writeSummaryAt({ agoMs: 2 * HOUR_MS });
    await mountPane();

    const line = stateLine();
    expect(line.getAttribute('data-stale')).toBe('branches');
    expect(line.getAttribute('aria-label')).toContain('a branch is newer');
  });

  it('draws no sentence for a summary without a State section', async () => {
    seedCentralColumn({ kind: 'mid' });
    act(() => {
      useAppStore.setState({
        sessionSlots: {
          [COLUMN_SESSION_ID]: [
            { key: 'goal', value: 'Add per-tenant payout limits.', enabled: true },
            { key: 'last_output_summary', value: '## Next\n- Review the fix.', enabled: true },
          ],
        },
      });
    });
    render(
      <ToastProvider>
        <SessionOverviewPane session={mountedSession()} />
      </ToastProvider>,
    );
    await settle();

    expect(document.querySelector('[data-summary-state]')).toBeNull();
  });

  it('draws no sentence on an archived session, which keeps only Done', async () => {
    seedCentralColumn({ kind: 'mid' });
    act(() => {
      useAppStore.setState((state) => ({
        sessions: state.sessions.map((session) => ({
          ...session,
          archivedAt: brandId<IsoDateTime>({ value: '2026-10-18T10:00:00.000Z' }),
        })),
      }));
    });
    render(
      <ToastProvider>
        <SessionOverviewPane session={mountedSession()} />
      </ToastProvider>,
    );
    await settle();

    expect(document.querySelector('[data-summary-state]')).toBeNull();
  });
});
