// @vitest-environment happy-dom
vi.hoisted(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 18, 10, 31, 0));
});

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../test/fakeResizeObserver';
import { sceneInvoke, clearSceneInvoke } from '../../../../test/sceneInvoke';
import { resetWorktreeStatusCache } from '../../../../store/runtime/worktreeStatuses/cache';
import { AutoReleaseContext } from '../../../auto/autoReleaseContext';
import { ObjectMenuProvider } from '../../../actions/components/ObjectMenuProvider';
import {
  COLUMN_SESSION_ID,
  seedCentralColumn,
} from '../../../../app/components/MockScene/scenes/u26/centralColumnSeed';

let useAppStore: Awaited<ReturnType<typeof importStore>>;
let SessionOverviewPane: typeof import('.').SessionOverviewPane;

beforeAll(async () => {
  installFakeResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
  useAppStore = await importStore();
  ({ SessionOverviewPane } = await import('.'));
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  window.localStorage.clear();
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

const show = async () => {
  const session = useAppStore
    .getState()
    .sessions.find((candidate) => candidate.id === COLUMN_SESSION_ID);
  if (session === undefined) {
    throw new Error('The seed must hold the session');
  }
  const view = render(
    <ToastProvider>
      <ObjectMenuProvider>
        <AutoReleaseContext.Provider value>
          <SessionOverviewPane session={session} />
        </AutoReleaseContext.Provider>
      </ObjectMenuProvider>
    </ToastProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  return view;
};

const READING_ORDER = [
  '[data-overview-facts]',
  '[data-overview-section="needs-you"]',
  '[data-overview-section="now"]',
  '[data-overview-section="next"]',
  '[data-slot="project-blocks"]',
  '[data-overview-section="activity"]',
  '[data-overview-ask]',
];

describe('the reading order of the Overview', () => {
  it('reads the facts, Needs you, Now, Next, Projects, Activity, then the Ask line at the foot', async () => {
    seedCentralColumn({ kind: 'branches' });
    await show();
    const column = document.querySelector('[data-central-column]');
    const all = [...(column?.querySelectorAll('*') ?? [])];
    const shown = READING_ORDER.flatMap((selector) => {
      const node = column?.querySelector(selector);
      return node === null || node === undefined ? [] : [{ selector, at: all.indexOf(node) }];
    });

    for (const required of [
      '[data-overview-facts]',
      '[data-slot="project-blocks"]',
      '[data-overview-section="activity"]',
      '[data-overview-ask]',
    ]) {
      expect(shown.map((entry) => entry.selector)).toContain(required);
    }
    const positions = shown.map((entry) => entry.at);
    expect(positions).toEqual([...positions].sort((first, second) => first - second));
    expect(column?.lastElementChild?.matches('[data-overview-ask]')).toBe(true);
  });

  it.each([
    ['mid', false],
    ['finished', false],
    ['finished', true],
    ['branches', false],
    ['orchestrated', false],
    ['agent', false],
  ] as const)(
    'opens a %s session (archived: %s) on the quiet facts, with no project state sentence',
    async (kind, isArchived) => {
      seedCentralColumn({ kind });
      if (isArchived) {
        useAppStore.setState((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === COLUMN_SESSION_ID
              ? { ...session, archivedAt: session.updatedAt }
              : session,
          ),
        }));
      }
      await show();
      const column = document.querySelector('[data-central-column]');

      expect(column?.firstElementChild?.matches('[data-overview-facts]')).toBe(true);
      const sentences = [...(column?.querySelectorAll('p') ?? [])].map(
        (node) => node.textContent ?? '',
      );
      expect(sentences.filter((text) => /^(payments-api|ledger-core): /.test(text))).toEqual([]);
    },
  );

  it('says each fact once: one spend, no tiles, no provenance line', async () => {
    seedCentralColumn({ kind: 'branches' });
    await show();
    const column = document.querySelector('[data-central-column]');

    expect(column?.querySelectorAll('[data-session-spend]')).toHaveLength(1);
    expect(column?.querySelector('[data-slot="session-kpis"]')).toBeNull();
    expect(screen.queryByText(/^From chat/)).toBeNull();
  });

  it('keeps Show dev details per workspace, shown at first', async () => {
    seedCentralColumn({ kind: 'branches' });
    const first = await show();

    fireEvent.click(screen.getByRole('button', { name: 'Hide dev details' }));
    screen.getByRole('button', { name: 'Show dev details' });
    first.unmount();

    await show();
    screen.getByRole('button', { name: 'Show dev details' });
    fireEvent.click(screen.getByRole('button', { name: 'Show dev details' }));
    screen.getByRole('button', { name: 'Hide dev details' });
  });
});
