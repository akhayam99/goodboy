// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  SESSION_PAGE_INTRO,
  SESSION_PAGE_MARKER_WHY,
} from '../../../../../features/session/sessionPageIntro';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U26_INTROS_SCENES } from './intros';
import type { IntroPage } from './introsSeed';

const SETTLE_MS = 2_000;

type SceneName = keyof typeof U26_INTROS_SCENES;

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

type MountParams = {
  readonly name: SceneName;
};

const mount = async ({ name }: MountParams): Promise<void> => {
  const Scene = U26_INTROS_SCENES[name];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  expect(screen.queryByText('Something went wrong')).toBeNull();
};

const headerOf = (): HTMLElement => {
  const header = document.querySelector<HTMLElement>('[data-slot="pane-header"]');
  if (header === null) {
    throw new Error('no page header');
  }
  return header;
};

const currentPage = (): string | null =>
  document.querySelector('[data-testid="session-pages"] [aria-current="page"]')?.textContent ??
  null;

type Case = {
  readonly page: IntroPage;
  readonly title: string;
  readonly content: SceneName;
  readonly empty: SceneName;
  readonly row: string;
  readonly emptyTitle: string;
  readonly emptyAction: string | null;
};

const CASES: ReadonlyArray<Case> = [
  {
    page: 'runs',
    title: 'Runs',
    content: 'u26-intros-runs',
    empty: 'u26-intros-runs-empty',
    row: 'Fix flaky tests in the ledger export',
    emptyTitle: 'No runs yet',
    emptyAction: 'Run a workflow',
  },
  {
    page: 'orchestrated',
    title: 'Orchestrated',
    content: 'u26-intros-orchestrated',
    empty: 'u26-intros-orchestrated-empty',
    row: 'Speed up the export end to end',
    emptyTitle: 'No orchestrated runs yet',
    emptyAction: 'Run an orchestrator',
  },
  {
    page: 'agents',
    title: 'Agents',
    content: 'u26-intros-agents',
    empty: 'u26-intros-agents-empty',
    row: 'Add the retry header to notify-relay',
    emptyTitle: 'No agents in this session yet.',
    emptyAction: null,
  },
  {
    page: 'auto',
    title: 'Auto agents',
    content: 'u26-intros-auto',
    empty: 'u26-intros-auto-empty',
    row: 'Why does payments-api retry a settled webhook?',
    emptyTitle: 'No Auto agents yet',
    emptyAction: 'Start an auto',
  },
];

const RETIRED_EMPTY_LINES = [
  'A run is a workflow working on this session.',
  'The orchestrator picks each next step from your goal.',
  'Auto answers itself, or starts the right agent.',
];

type IntroParams = {
  readonly page: IntroPage;
  readonly title: string;
};

const expectIntro = ({ page, title }: IntroParams) => {
  const header = headerOf();
  expect(within(header).getByRole('heading', { level: 1, name: title })).toBeDefined();
  const intro = header.querySelector<HTMLElement>('[data-slot="session-page-intro"]');
  expect(intro?.dataset.page).toBe(page);
  expect([...(intro?.querySelectorAll('p') ?? [])].map((line) => line.textContent)).toEqual([
    ...SESSION_PAGE_INTRO[page],
  ]);
  expect(currentPage()).toContain(title);
};

describe('the u26 session page intro scenes', () => {
  it('registers every scene in the mock registry', () => {
    for (const name of Object.keys(U26_INTROS_SCENES)) {
      expect(MOCK_SCENES[name], name).toBeDefined();
    }
  });

  it.each(CASES)('$content shows the $page intro in the header over its rows', async (entry) => {
    await mount({ name: entry.content });

    expectIntro({ page: entry.page, title: entry.title });
    expect(screen.getAllByText(entry.row).length).toBeGreaterThan(0);
  });

  it.each(CASES)(
    '$empty keeps the intro and an empty state with only its title and action',
    async (entry) => {
      await mount({ name: entry.empty });

      expectIntro({ page: entry.page, title: entry.title });
      expect(screen.getByText(entry.emptyTitle)).toBeDefined();
      if (entry.emptyAction !== null) {
        expect(screen.getByRole('button', { name: entry.emptyAction })).toBeDefined();
      }
      for (const line of RETIRED_EMPTY_LINES) {
        expect(screen.queryByText(line)).toBeNull();
      }
    },
  );

  it.each([
    ['u26-rail-marker-auto-light', SESSION_PAGE_MARKER_WHY.auto],
    ['u26-rail-marker-auto-dark', SESSION_PAGE_MARKER_WHY.auto],
  ] as const)('%s opens the marker tooltip with its words', async (name, why) => {
    await mount({ name });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SETTLE_MS);
    });

    expect(screen.getByRole('tooltip').textContent).toBe(why);
  });
});
