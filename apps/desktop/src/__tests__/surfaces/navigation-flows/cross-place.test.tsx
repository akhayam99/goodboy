// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((command: string, args?: BridgeArgs) => bridge(command, args)),
}));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => undefined),
  emit: vi.fn(async () => undefined),
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type {
  ArtifactId,
  Session,
  SessionId,
  StepId,
  Workflow,
  WorkflowId,
  WorkspaceId,
} from '@goodboy/types';
import { seedSessionAsk } from '../../../app/components/MockScene/scenes/sessionAskSeed';
import type { ShortcutId } from '../../../shared/keyboard/registry';
import { STORY_NOW } from '../../../store/storyHarness';
import type { DrawerRequest } from '../../../store/slices/drawer/state';
import { selectOpenDrawer } from '../../../store/slices/drawer/selectOpenDrawer';
import { agentPlace, sessionPlace } from '../../../store';
import { pressShortcut } from '../../helpers/pressKey';
import {
  WAIT,
  boot,
  bridge,
  click,
  clickButton,
  consoleErrors,
  heading,
  installNavigationHooks,
  openCrumb,
  openPalette,
  settle,
  visible,
  useAppStore,
  type BridgeArgs,
} from './harness';

installNavigationHooks();

const JOURNEY_MS = 60_000;

const door = (id: string): HTMLElement => {
  const found = document.querySelector<HTMLElement>(
    `[data-side-column] [data-column-layer="nav"] [data-column-door="${id}"], [data-column-rail] [data-column-door="${id}"]`,
  );
  expect(found, `no ${id} door in the column or the rail`).not.toBeNull();
  return found as HTMLElement;
};

const historyButton = (verb: 'Back' | 'Forward'): HTMLElement => {
  const found = Array.from(
    document.querySelectorAll<HTMLElement>('[data-nav-cluster] button'),
  ).find((button) => (button.getAttribute('aria-label') ?? '').startsWith(verb));
  expect(found).toBeDefined();
  return found as HTMLElement;
};

const press = async (id: ShortcutId): Promise<void> => {
  const anchor = await screen.findByRole('button', { name: /^Search or ask/ });
  anchor.focus();
  pressShortcut({ id });
  await settle();
};

const escape = async (): Promise<void> => {
  fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
  await settle(12);
};

const backToApp = async (): Promise<void> => {
  await click(screen.getByRole('button', { name: /^Back to app/ }));
  await settle(8);
};

const studio = (): string | null => useAppStore.getState().appStudio?.kind ?? null;

const lensOf = (): string | null => {
  const state = useAppStore.getState();
  const sessionId = state.currentSessionId;
  return sessionId === null ? 'board' : (state.activeLens[sessionId] ?? null);
};

const currentDoors = (): ReadonlyArray<string> =>
  Array.from(
    document.querySelectorAll(
      '[data-side-column] [data-column-layer="nav"] [data-column-door][aria-current="page"], [data-column-rail] [data-column-door][aria-current="page"], [data-top-bar] [aria-current="page"]',
    ),
  ).map(
    (element) =>
      element.getAttribute('data-column-door') ?? element.getAttribute('aria-label') ?? '',
  );

const expectColumnBesideStudio = (): void => {
  const column = document.querySelector('[data-side-column], [data-column-rail]');
  expect(column).not.toBeNull();
  expect(column?.closest('aside')?.hasAttribute('inert')).toBe(false);
  expect(document.querySelector('[data-studio-slot="content"]')).not.toBeNull();
  expect(document.querySelector('[data-studio-slot="cover"]')).toBeNull();
};

const expectHealthy = (): void => {
  expect(
    consoleErrors.filter((line) =>
      ['Maximum update depth', '#185', 'getSnapshot should be cached'].some((marker) =>
        line.includes(marker),
      ),
    ),
  ).toEqual([]);
  expect(screen.queryByText('Something went wrong')).toBeNull();
};

const SHIP_ID = 'journey-workflow-ship-a-fix' as WorkflowId;

const JOURNEY_ARTIFACT = 'journey-artifact-plan' as ArtifactId;

const seedShipAFix = (): void => {
  const state = useAppStore.getState();
  const workspaceId = state.currentWorkspaceId as WorkspaceId;
  const workflow: Workflow = {
    id: SHIP_ID,
    workspaceId,
    name: 'Ship a fix',
    description: '',
    steps: ['Plan', 'Implement'].map((name, ordinal) => ({
      id: `${SHIP_ID}-step-${ordinal}` as StepId,
      workflowId: SHIP_ID,
      ordinal,
      name,
      promptPrefix: '',
    })),
    createdAt: STORY_NOW,
    updatedAt: STORY_NOW,
  };
  useAppStore.setState({
    phaseTemplates: { ...state.phaseTemplates, [workspaceId]: [workflow] },
  });
};

const SESSION_PAGES: ReadonlyArray<readonly [string, string | null]> = [
  ['Branch', 'branch'],
  ['Runs', 'workflows'],
  ['Agents', 'agents'],
  ['Artifacts', 'plans'],
  ['Overview', null],
];

const STUDIO_DOORS: ReadonlyArray<readonly [string, string]> = [
  ['inbox', 'inbox'],
  ['chat', 'chat'],
  ['workflows', 'workflow'],
];

type ExpectedPlace = {
  readonly session: SessionId | null;
  readonly lens: string | null;
  readonly studio: string | null;
  readonly doors: ReadonlyArray<string>;
};

const expectPlace = ({ session, lens, studio: kind, doors }: ExpectedPlace): void => {
  expect(useAppStore.getState().currentSessionId).toBe(session);
  expect(lensOf()).toBe(lens);
  expect(studio()).toBe(kind);
  expect(currentDoors()).toEqual(doors);
};

type ColumnState = 'column' | 'rail' | 'settings';

const expectColumn = (expected: ColumnState): void => {
  const column = document.querySelector('[data-side-column]');
  const rail = document.querySelector('[data-column-rail]');
  const nav = document.querySelector('[data-column-layer="nav"]');
  const settings = document.querySelector('[data-column-layer="settings"]');
  if (expected === 'rail') {
    expect(rail).not.toBeNull();
    expect(column).toBeNull();
    return;
  }
  expect(column).not.toBeNull();
  expect(rail).toBeNull();
  expect(nav?.hasAttribute('inert')).toBe(expected === 'settings');
  if (expected === 'settings') {
    expect(settings?.hasAttribute('inert')).toBe(false);
    expect(screen.getByRole('button', { name: /^Back to app/ })).toBeDefined();
  }
};

type FocusOwner = 'drawer' | 'column' | 'main' | 'studio' | 'none';

const focusOwner = (): FocusOwner => {
  const active = document.activeElement;
  if (active === null || active === document.body) {
    return 'none';
  }
  if (active.closest('aside[aria-label="Side panel"]') !== null) {
    return 'drawer';
  }
  if (active.closest('[data-side-column], [data-column-rail]') !== null) {
    return 'column';
  }
  if (active.closest('[data-studio-slot]') !== null) {
    return 'studio';
  }
  return active.closest('[data-drawer-main]') === null ? 'none' : 'main';
};

type LeftEdge = {
  readonly main: Element | null;
  readonly pageColumn: string | null;
  readonly columns: ReadonlyArray<string>;
};

const visiblePageColumns = (): ReadonlyArray<HTMLElement> =>
  [...document.querySelectorAll<HTMLElement>('main [data-drawer-main] [data-page-column]')].filter(
    (column) => column.closest('[inert]') === null && column.closest('.invisible') === null,
  );

const columnShape = (column: HTMLElement): string => column.getAttribute('data-width') ?? '';

const leftEdge = (): LeftEdge => {
  const main = document.querySelector('main [data-drawer-main]');
  const columns = visiblePageColumns();
  return {
    main,
    pageColumn: columns[0]?.className ?? null,
    columns: columns.map(columnShape),
  };
};

const expectCentredColumns = (): void => {
  const { columns } = leftEdge();
  expect(columns.length).toBeGreaterThan(0);
  for (const shape of columns) {
    expect(['column', 'measure', 'full']).toContain(shape);
  }
};

const expectAskInColumn = (): void => {
  const end = document.querySelector('main [data-slot="trail-end"]');
  const column = end?.closest<HTMLElement>('[data-page-column]') ?? null;
  expect(column, 'the Ask button sits in the trail column').not.toBeNull();
  expect(column?.querySelector('[data-testid="ask-trail-button"]')).not.toBeNull();
  expect(end?.parentElement).toBe(column);
  expect(end?.nextElementSibling).toBeNull();
};

const expectDrawerBesideContent = ({
  edge,
  kind,
}: {
  readonly edge: LeftEdge;
  readonly kind: string;
}): void => {
  const now = leftEdge();
  expect(now.main, `${kind} keeps the page mounted`).toBe(edge.main);
  expect(now.pageColumn, `${kind} keeps the page column`).toBe(edge.pageColumn);
  expect(now.columns, `${kind} keeps every column where it was`).toEqual(edge.columns);
  const aside = document.querySelector('main aside[aria-label="Side panel"]');
  expect(aside?.getAttribute('data-drawer-mode'), kind).not.toBe('closed');
  expect(
    (now.main as Node).compareDocumentPosition(aside as Node) & Node.DOCUMENT_POSITION_FOLLOWING,
    `${kind} opens on the right of the page`,
  ).toBeTruthy();
};

const openDrawerKind = (): string | null => selectOpenDrawer(useAppStore.getState())?.kind ?? null;

const drawerRequests = (sessionId: SessionId): ReadonlyArray<DrawerRequest> => {
  const state = useAppStore.getState();
  const agent = state.sessionPhaseRuns[sessionId]?.[0];
  const plan = state.sessionPlans[sessionId]?.[0];
  const mount = state.sessionProjectMounts[sessionId]?.[0];
  return [
    { kind: 'context', sessionId, payload: { tab: 'goal', view: 'current' } },
    { kind: 'ask', sessionId, payload: null },
    {
      kind: 'scriptRun',
      sessionId,
      payload: { scriptKey: 'test', mountId: mount?.mountId ?? null },
    },
    ...(mount === undefined
      ? []
      : [
          {
            kind: 'file-diff' as const,
            sessionId,
            payload: {
              source: { kind: 'worktree' as const, worktreePath: mount.worktreePath },
              path: 'src/importer.ts',
            },
          },
        ]),
    ...(agent === undefined
      ? []
      : [{ kind: 'transcript' as const, sessionId, payload: { agentId: agent.id } }]),
    ...(plan === undefined
      ? []
      : [
          {
            kind: 'artifact-document' as const,
            sessionId,
            payload: { artifactId: plan.id, revision: null },
          },
          { kind: 'plan-part' as const, sessionId, payload: { planId: plan.id, index: 0 } },
        ]),
  ];
};

const sessionRow = (sessionId: SessionId): HTMLElement => {
  const found = document.querySelector<HTMLElement>(
    `[data-side-column] [data-column-sessions] [data-select-id="${sessionId}"]`,
  );
  expect(found, `no row for ${sessionId} in the column`).not.toBeNull();
  return found as HTMLElement;
};

const pageRow = (label: string): HTMLElement => {
  const pages = screen.getByTestId('session-pages');
  const found = within(pages)
    .getAllByRole('button')
    .find((button) => button.textContent?.startsWith(label));
  expect(found, `no ${label} page row`).toBeDefined();
  return found as HTMLElement;
};

const currentPage = (): string | null => {
  const pages = document.querySelector('[data-testid="session-pages"]');
  const current = pages?.querySelector('[aria-current="page"]');
  return current?.querySelector('span')?.textContent ?? null;
};

const otherSession = (sessionId: SessionId): SessionId => {
  const other = useAppStore
    .getState()
    .sessions.find(
      (session) =>
        session.id !== sessionId &&
        document.querySelector(`[data-column-sessions] [data-select-id="${session.id}"]`) !== null,
    );
  expect(other).toBeDefined();
  return other?.id as SessionId;
};

const currentSession = (sessionId: SessionId): Session => {
  const session = useAppStore.getState().sessions.find((candidate) => candidate.id === sessionId);
  if (session === undefined) {
    throw new Error(`no session ${sessionId} in the store`);
  }
  return session;
};

const CHIP_LENS: Readonly<Record<string, string>> = {
  question: 'questions',
  run: 'workflows',
  agent: 'agents',
};

type AskChipTarget = {
  readonly button: HTMLElement;
  readonly lens: string;
};

const askChipAwayFrom = async ({ lens }: { readonly lens: string }): Promise<AskChipTarget> => {
  const answer = await screen.findByTestId('ask-answer', undefined, WAIT);
  const chips = Array.from(answer.querySelectorAll<HTMLElement>('[data-ask-kind]'));
  const found = chips
    .map((chip) => ({
      button: chip.querySelector<HTMLElement>('button'),
      lens: CHIP_LENS[chip.getAttribute('data-ask-kind') ?? ''],
    }))
    .find(
      (candidate): candidate is AskChipTarget =>
        candidate.button !== null && candidate.lens !== undefined && candidate.lens !== lens,
    );
  expect(
    found,
    `the answer names a question, a run or an agent: ${chips.map((chip) => chip.getAttribute('data-ask-kind')).join(', ')}`,
  ).toBeDefined();
  return found as AskChipTarget;
};

const RAIL_TOKEN = /^(mx-auto|max-w-\[var\(--(column|measure)-frame\)\])$/;

const railOf = (element: Element | null): string => {
  const column = element?.closest<HTMLElement>('[data-page-column]') ?? null;
  if (column === null) {
    return 'none';
  }
  const tokens = column.className.split(/\s+/).filter((token) => RAIL_TOKEN.test(token));
  return `${column.getAttribute('data-width')} ${tokens.join(' ')}`.trim();
};

const COLUMN_RAIL = 'column mx-auto max-w-[var(--column-frame)]';
const FULL_RAIL = 'full';

const placeRoot = (): Element => {
  const root =
    document.querySelector('[data-studio-slot]') ??
    document.querySelector('main [data-drawer-main]');
  expect(root, 'no page root').not.toBeNull();
  return root as Element;
};

const isShown = (element: Element): boolean =>
  element.closest('[inert]') === null && element.closest('.invisible') === null;

const shown = (selector: string): Element | null =>
  [...placeRoot().querySelectorAll(selector)].find(isShown) ?? null;

const scrollContent = (): Element | null =>
  shown('[data-slot="pane-body"] .overflow-y-auto')?.firstElementChild ?? null;

type RailLayers = Readonly<Record<string, Element | null>>;

const expectOneRail = ({
  place,
  layers,
  rail,
}: {
  readonly place: string;
  readonly layers: RailLayers;
  readonly rail: string;
}): void => {
  for (const [name, element] of Object.entries(layers)) {
    expect(element, `${place}: no ${name} layer`).not.toBeNull();
    expect(railOf(element), `${place}: ${name} sits on the page rail`).toBe(rail);
  }
};

const sessionLayers = (extra: RailLayers): RailLayers => ({
  header: shown('[data-slot="pane-header"]'),
  trail: document.querySelector('main [data-slot="trail-end"]'),
  ...extra,
});

const openContextDrawer = async (sessionId: SessionId): Promise<void> => {
  act(() =>
    useAppStore.getState().openDrawer({
      kind: 'context',
      sessionId,
      payload: { tab: 'goal', view: 'current' },
    }),
  );
  await settle();
  expect(openDrawerKind()).toBe('context');
};

const openAgentTranscript = async (sessionId: SessionId): Promise<void> => {
  const state = useAppStore.getState();
  const agent = (state.sessionPhaseRuns[sessionId] ?? []).find(
    (candidate) => candidate.workflowRunId == null && candidate.deletedAt == null,
  );
  expect(agent, 'the seeded session has a standalone agent').toBeDefined();
  state.navigate({ to: agentPlace({ sessionId, agentId: agent?.id as never }) });
  await settle();
  await screen.findByPlaceholderText(/^What should .* build\?/, undefined, WAIT);
};

const sessionRuns = (sessionId: SessionId): number =>
  useAppStore.getState().sessions.find((session) => session.id === sessionId)?.workflowRuns
    .length ?? 0;

describe('moving across every place keeps one frame', () => {
  it(
    'walks the board, a session and its pages, then Back and Forward retrace them',
    async () => {
      const { sessionId } = await boot({ seed: 'pr' });

      await click(door('board'));
      await heading('Board');
      expect(currentDoors()).toEqual(['board']);

      await click(historyButton('Back'));
      expect(useAppStore.getState().currentSessionId).toBe(sessionId);
      expect(currentDoors()).toEqual([]);

      await openCrumb(/^Agents/);
      expect(lensOf()).toBe('agents');
      await press('lens.workflows');
      await press('lens.plans');
      await press('lens.review');
      expect(lensOf()).toBe('branch');

      await click(historyButton('Back'));
      expect(lensOf()).toBe('plans');
      await click(historyButton('Back'));
      expect(lensOf()).toBe('workflows');
      await click(historyButton('Forward'));
      expect(lensOf()).toBe('plans');
      expect(document.querySelector('[data-side-column]')).not.toBeNull();
      expectHealthy();
    },
    JOURNEY_MS,
  );

  it(
    'opens every studio beside the column from a session page and lands back on that page',
    async () => {
      await boot({ seed: 'pr' });
      await openCrumb(/^Agents/);

      const doors: ReadonlyArray<readonly [() => HTMLElement, string]> = [
        [() => door('inbox'), 'inbox'],
        [() => door('chat'), 'chat'],
        [() => door('workflows'), 'workflow'],
        [() => screen.getByRole('button', { name: 'Impact' }), 'impact'],
      ];
      for (const [control, kind] of doors) {
        await click(control());
        expect(studio()).toBe(kind);
        expectColumnBesideStudio();
        await escape();
        expect(studio()).toBeNull();
        expect(lensOf()).toBe('agents');
      }

      await openPalette(/^Notifications$/, 'Notifications');
      expect(studio()).toBe('notifications');
      expectColumnBesideStudio();
      expect(currentDoors()).toEqual([]);
      await escape();
      expect(lensOf()).toBe('agents');
      expectHealthy();
    },
    JOURNEY_MS,
  );

  it(
    'swaps the column for Settings, and Back to app, Esc and Back all land on the same page',
    async () => {
      await boot({ seed: 'pr' });
      await openCrumb(/^Agents/);

      const exits: ReadonlyArray<readonly [() => Promise<void>, () => HTMLElement]> = [
        [
          async () => {
            screen.getByRole('button', { name: /^Back to app/ }).focus();
            await backToApp();
          },
          () => door('settings'),
        ],
        [
          async () => {
            screen.getByRole('searchbox', { name: 'Search settings' }).focus();
            await escape();
          },
          () => door('settings'),
        ],
        [
          async () => {
            historyButton('Back').focus();
            await click(historyButton('Back'));
          },
          () => historyButton('Back'),
        ],
      ];
      for (const [exit, expectedFocus] of exits) {
        door('settings').focus();
        await click(door('settings'));
        expect(studio()).toBe('settings');
        expect(screen.getByRole('navigation', { name: 'Settings scopes' })).toBeDefined();
        expect(document.querySelector('[data-column-layer="nav"]')?.hasAttribute('inert')).toBe(
          true,
        );

        await exit();

        expect(studio()).toBeNull();
        expect(lensOf()).toBe('agents');
        expect(document.querySelector('[data-column-layer="nav"]')?.hasAttribute('inert')).toBe(
          false,
        );
        expect(document.activeElement).toBe(expectedFocus());
      }

      await openPalette(/^Settings$/, 'Settings');
      expect(studio()).toBe('settings');
      screen.getByRole('button', { name: /^Back to app/ }).focus();
      await backToApp();
      expect(document.activeElement, 'falls back to the Settings door').toBe(door('settings'));
      expectHealthy();
    },
    JOURNEY_MS,
  );

  it(
    'finds a setting from the column search and opens its page in place',
    async () => {
      await boot({ seed: 'pr' });
      await click(door('settings'));
      const entriesBefore =
        useAppStore.getState().navigation[useAppStore.getState().currentWorkspaceId ?? '']?.entries
          .length;

      fireEvent.change(screen.getByRole('searchbox', { name: 'Search settings' }), {
        target: { value: 'storage' },
      });
      await settle();
      const results = screen.getByRole('list', { name: 'Matching settings' });
      await click(within(results).getAllByRole('button')[0] as HTMLElement);

      const focus = useAppStore.getState().appStudio;
      expect(focus?.kind).toBe('settings');
      expect(focus?.kind === 'settings' ? focus.focus.section : null).toBe('storage');
      expect(
        useAppStore.getState().navigation[useAppStore.getState().currentWorkspaceId ?? '']?.entries
          .length,
      ).toBe(entriesBefore);

      fireEvent.change(screen.getByRole('searchbox', { name: 'Search settings' }), {
        target: { value: 'zzzz nothing' },
      });
      await settle();
      expect(screen.getByText('No settings match')).toBeDefined();
    },
    JOURNEY_MS,
  );

  it(
    'folds into the rail of doors with ⌘B on the board, in a session, under a studio and under Settings',
    async () => {
      await boot({ seed: 'pr' });

      await press('column.toggle');
      expect(document.querySelector('[data-column-rail]')).not.toBeNull();
      expect(document.querySelector('[data-side-column]')).toBeNull();

      await click(door('inbox'));
      expect(studio()).toBe('inbox');
      expect(currentDoors()).toEqual(['inbox']);

      await click(door('settings'));
      expect(studio()).toBe('settings');
      expect(screen.getByRole('navigation', { name: 'Settings scopes' })).toBeDefined();

      await press('column.toggle');
      expect(document.querySelector('[data-side-column]')).not.toBeNull();
      expect(screen.getByRole('button', { name: /^Back to app/ })).toBeDefined();

      await backToApp();
      await click(door('board'));
      await heading('Board');
      await press('column.toggle');
      expect(door('board').getAttribute('aria-current')).toBe('page');
      await press('column.toggle');
      expect(door('board').getAttribute('aria-current')).toBe('page');
      expectHealthy();
    },
    JOURNEY_MS,
  );

  it(
    'keeps a drawer with its page while a studio sits over it',
    async () => {
      const { sessionId } = await boot({ seed: 'pr' });

      await press('lens.context');
      await waitFor(
        () => expect(selectOpenDrawer(useAppStore.getState())?.kind).toBe('context'),
        WAIT,
      );

      await click(door('inbox'));
      expect(studio()).toBe('inbox');
      await escape();

      expect(studio()).toBeNull();
      expect(useAppStore.getState().currentSessionId).toBe(sessionId);
      expect(selectOpenDrawer(useAppStore.getState())?.kind).toBe('context');
      expectHealthy();
    },
    JOURNEY_MS,
  );

  it(
    'keeps the centred column at the same x across Overview, Runs, Agents, Artifacts and Settings, drawer or not',
    async () => {
      const { sessionId } = await boot({ seed: 'pr' });
      seedShipAFix();
      await click(sessionRow(sessionId));

      const PAGES = ['Overview', 'Runs', 'Agents', 'Artifacts'] as const;
      const trailColumn = (): string =>
        document.querySelector('main [data-slot="trail-bar"] [data-page-column]')?.className ?? '';
      const columnTiers = (): ReadonlySet<string> =>
        new Set(
          visiblePageColumns()
            .filter((column) => column.getAttribute('data-width') !== 'full')
            .map((column) => columnShape(column)),
        );

      const walk = async (withDrawer: boolean): Promise<ReadonlyArray<string>> => {
        const trails: Array<string> = [];
        for (const page of PAGES) {
          await click(pageRow(page));
          expect(currentPage()).toBe(page);
          if (withDrawer) {
            act(() =>
              useAppStore.getState().openDrawer({
                kind: 'context',
                sessionId,
                payload: { tab: 'goal', view: 'current' },
              }),
            );
            await settle();
            expect(openDrawerKind(), `${page} opens the drawer`).toBe('context');
          }
          expectCentredColumns();
          expectAskInColumn();
          for (const shape of columnTiers()) {
            expect(['column', 'measure'], `${page} centres its column`).toContain(shape);
          }
          trails.push(trailColumn());
          if (withDrawer) {
            await escape();
          }
        }
        return trails;
      };

      const atRest = await walk(false);
      expect(new Set(atRest).size, 'the trail column keeps one shape without a drawer').toBe(1);
      const withDrawer = await walk(true);
      expect(new Set(withDrawer).size, 'the trail column keeps one shape with a drawer').toBe(1);
      expect(withDrawer[0], 'a drawer slides the column, it does not reshape it').toBe(atRest[0]);

      door('settings').focus();
      await click(door('settings'));
      expect(studio()).toBe('settings');
      const settingsColumns = [
        ...document.querySelectorAll<HTMLElement>('[data-studio-slot] [data-page-column]'),
      ].filter((column) => column.getAttribute('data-width') !== 'full');
      expect(settingsColumns.length).toBeGreaterThan(0);
      for (const column of settingsColumns) {
        expect(['column', 'measure']).toContain(column.getAttribute('data-width'));
      }
    },
    JOURNEY_MS,
  );

  it(
    'puts header, Ask, body and composer of every page on one rail, drawer or not',
    async () => {
      const { sessionId } = await boot({ seed: 'pr' });
      seedShipAFix();
      await click(sessionRow(sessionId));

      const overviewLayers = (): RailLayers =>
        sessionLayers({ body: shown('[data-slot="pane-body"]') });
      expect(currentPage()).toBe('Overview');
      expectOneRail({ place: 'Overview', layers: overviewLayers(), rail: COLUMN_RAIL });
      await openContextDrawer(sessionId);
      expectOneRail({
        place: 'Overview with a drawer',
        layers: overviewLayers(),
        rail: COLUMN_RAIL,
      });
      await escape();

      await openAgentTranscript(sessionId);
      const agentLayers = (): RailLayers =>
        sessionLayers({ transcript: scrollContent(), composer: shown('textarea') });
      expectOneRail({ place: 'Agent transcript', layers: agentLayers(), rail: COLUMN_RAIL });
      await openContextDrawer(sessionId);
      expectOneRail({
        place: 'Agent transcript with a drawer',
        layers: agentLayers(),
        rail: COLUMN_RAIL,
      });
      await escape();

      await click(screen.getByRole('tab', { name: 'Brief' }));
      const briefLayers = (): RailLayers =>
        sessionLayers({ body: shown('[data-slot="pane-body"]') });
      expectOneRail({ place: 'Agent brief', layers: briefLayers(), rail: COLUMN_RAIL });
      await openContextDrawer(sessionId);
      expectOneRail({
        place: 'Agent brief with a drawer',
        layers: briefLayers(),
        rail: COLUMN_RAIL,
      });
      await escape();

      act(() => {
        const state = useAppStore.getState();
        useAppStore.setState({
          sessionBranches: { ...state.sessionBranches, [sessionId]: '' },
          sessionProjectMounts: { ...state.sessionProjectMounts, [sessionId]: [] },
        });
        state.navigate({ to: sessionPlace({ sessionId, lens: 'files' }) });
      });
      await settle();
      expect(lensOf()).toBe('files');
      const versionLayers = (): RailLayers =>
        sessionLayers({ body: shown('[data-slot="pane-body"]') });
      expectOneRail({ place: 'File versions', layers: versionLayers(), rail: FULL_RAIL });
      await openContextDrawer(sessionId);
      expectOneRail({
        place: 'File versions with a drawer',
        layers: versionLayers(),
        rail: FULL_RAIL,
      });
      await escape();

      await click(door('chat'));
      expect(studio()).toBe('chat');
      expectOneRail({
        place: 'Chat',
        layers: { header: shown('header h2'), composer: shown('textarea') },
        rail: COLUMN_RAIL,
      });

      await click(door('settings'));
      expect(studio()).toBe('settings');
      expectOneRail({
        place: 'Settings',
        layers: {
          header: shown('[data-slot="pane-header"]'),
          body: shown('[data-slot="pane-body"]'),
        },
        rail: COLUMN_RAIL,
      });
    },
    JOURNEY_MS,
  );

  it(
    'walks one app instance across the column, every page, drawer, studio and the palette',
    async () => {
      const { sessionId } = await boot({ seed: 'pr' });
      seedShipAFix();

      await click(door('board'));
      await heading('Board');
      expectPlace({ session: null, lens: 'board', studio: null, doors: ['board'] });
      expectColumn('column');

      await click(sessionRow(sessionId));
      expectPlace({ session: sessionId, lens: null, studio: null, doors: [] });
      expect(sessionRow(sessionId).getAttribute('aria-current')).toBe('true');
      expect(currentPage()).toBe('Overview');

      for (const [page, lens] of SESSION_PAGES) {
        await click(pageRow(page));
        expectPlace({ session: sessionId, lens, studio: null, doors: [] });
        expect(currentPage()).toBe(page);
        expectCentredColumns();
        expectAskInColumn();
        const trail = document.querySelector('main [data-slot="trail-bar"] [data-page-column]');
        expect(trail?.getAttribute('data-width')).toBe(lens === 'branch' ? 'full' : 'column');
      }

      await click(pageRow('Branch'));
      for (const tab of ['Files', 'Comments'] as const) {
        await click(screen.getByRole('tab', { name: new RegExp(`^${tab}`) }));
        expect(useAppStore.getState().branchTab[sessionId]).toBe(tab.toLowerCase());
        expectPlace({ session: sessionId, lens: 'branch', studio: null, doors: [] });
      }

      await press('ask.open');
      await waitFor(() => expect(openDrawerKind()).toBe('ask'), WAIT);
      await waitFor(() => expect(focusOwner()).toBe('drawer'), WAIT);
      expectPlace({ session: sessionId, lens: 'branch', studio: null, doors: [] });
      const askEdge = leftEdge();
      act(() => seedSessionAsk({ state: 'answer', session: currentSession(sessionId) }));
      await settle();
      const chip = await askChipAwayFrom({ lens: 'branch' });
      await click(chip.button);
      expect(openDrawerKind()).toBe('ask');
      expect(lensOf()).toBe(chip.lens);
      expect(leftEdge().main).toBe(askEdge.main);
      await click(historyButton('Back'));
      expectPlace({ session: sessionId, lens: 'branch', studio: null, doors: [] });
      await escape();
      expect(openDrawerKind()).toBeNull();

      const edge = leftEdge();
      for (const request of drawerRequests(sessionId)) {
        act(() => useAppStore.getState().openDrawer(request));
        await settle();
        expect(openDrawerKind(), request.kind).toBe(request.kind);
        expectDrawerBesideContent({ edge, kind: request.kind });
        await escape();
        expect(openDrawerKind(), `${request.kind} closes on Esc`).toBeNull();
        expect(leftEdge().main).toBe(edge.main);
        expectPlace({ session: sessionId, lens: 'branch', studio: null, doors: [] });
      }

      const other = otherSession(sessionId);
      useAppStore.getState().markSessionOpened({ sessionId: other });
      useAppStore.getState().markSessionOpened({ sessionId });
      await press('session.switcher');
      await visible('listbox', 'Recent sessions');
      fireEvent.keyUp(window, { key: 'Control', code: 'ControlLeft' });
      await settle();
      expect(screen.queryByRole('listbox', { name: 'Recent sessions' })).toBeNull();
      expectPlace({ session: other, lens: null, studio: null, doors: [] });
      expect(sessionRow(other).getAttribute('aria-current')).toBe('true');

      await click(historyButton('Back'));
      expectPlace({ session: sessionId, lens: 'branch', studio: null, doors: [] });
      await click(historyButton('Forward'));
      expectPlace({ session: other, lens: null, studio: null, doors: [] });
      await click(historyButton('Back'));

      await press('column.toggle');
      expectColumn('rail');
      expectPlace({ session: sessionId, lens: 'branch', studio: null, doors: [] });
      fireEvent.pointerEnter(screen.getByTestId('sidebar-peek-edge'));
      await settle(16);
      const peek = screen.getByRole('region', { name: 'Sessions' });
      expect(
        peek.querySelector(`[data-select-id="${sessionId}"]`)?.getAttribute('aria-current'),
      ).toBe('true');
      await click(peek.querySelector<HTMLElement>(`[data-select-id="${other}"]`) as HTMLElement);
      expectPlace({ session: other, lens: null, studio: null, doors: [] });
      await click(historyButton('Back'));
      await press('column.toggle');
      expectColumn('column');
      expectPlace({ session: sessionId, lens: 'branch', studio: null, doors: [] });

      door('settings').focus();
      await click(door('settings'));
      expectPlace({ session: sessionId, lens: 'branch', studio: 'settings', doors: ['settings'] });
      expectColumn('settings');
      screen.getByRole('button', { name: /^Back to app/ }).focus();
      await backToApp();
      expectPlace({ session: sessionId, lens: 'branch', studio: null, doors: [] });
      expectColumn('column');
      expect(document.activeElement).toBe(door('settings'));
      expect(useAppStore.getState().branchTab[sessionId]).toBe('comments');

      for (const [id, kind] of STUDIO_DOORS) {
        await click(door(id));
        expectPlace({ session: sessionId, lens: 'branch', studio: kind, doors: [id] });
        expectColumnBesideStudio();
        await escape();
        expectPlace({ session: sessionId, lens: 'branch', studio: null, doors: [] });
      }

      const runsBefore = sessionRuns(sessionId);
      await openPalette(/^Start a run$/, 'Start a run');
      fireEvent.mouseDown(await screen.findByRole('option', { name: /^Ship a fix/ }));
      await settle();
      await clickButton('Start run');
      await waitFor(() => expect(sessionRuns(sessionId)).toBe(runsBefore + 1), WAIT);
      expectPlace({ session: sessionId, lens: 'workflows', studio: null, doors: [] });
      expect(currentPage()).toBe('Runs');
      const page = document.querySelector<HTMLElement>('main [data-drawer-main]') as HTMLElement;
      expect(
        (await within(page).findAllByText(/Ship a fix/, undefined, WAIT)).length,
      ).toBeGreaterThan(0);
      expect(pageRow('Runs').textContent).toMatch(/\d/);
      expect(screen.queryByText(/workflow run/i)).toBeNull();

      const startedRun = currentSession(sessionId).workflowRuns.at(-1)?.id ?? null;
      expect(startedRun).not.toBeNull();
      act(() => useAppStore.getState().setFocusedWorkflowRun(sessionId, startedRun));
      await settle();
      await click(pageRow('Agents'));
      expectPlace({ session: sessionId, lens: 'agents', studio: null, doors: [] });
      expect(useAppStore.getState().focusedWorkflowRunId[sessionId] ?? null).toBeNull();
      await click(historyButton('Back'));
      expectPlace({ session: sessionId, lens: 'workflows', studio: null, doors: [] });
      expect(useAppStore.getState().focusedWorkflowRunId[sessionId]).toBe(startedRun);

      await click(pageRow('Artifacts'));
      expect(useAppStore.getState().focusedWorkflowRunId[sessionId] ?? null).toBeNull();
      act(() => useAppStore.getState().setFocusedArtifactId(sessionId, JOURNEY_ARTIFACT));
      await settle();
      await click(pageRow('Agents'));
      expect(useAppStore.getState().focusedArtifactId[sessionId] ?? null).toBeNull();
      await click(historyButton('Back'));
      expectPlace({ session: sessionId, lens: 'plans', studio: null, doors: [] });
      expect(useAppStore.getState().focusedArtifactId[sessionId]).toBe(JOURNEY_ARTIFACT);
      expectHealthy();
    },
    JOURNEY_MS,
  );

  it(
    'lands palette destinations in the frame and marks their door',
    async () => {
      await boot({ seed: 'pr' });

      await openPalette(/^Inbox$/, 'Inbox');
      expect(studio()).toBe('inbox');
      expect(currentDoors()).toEqual(['inbox']);
      expectColumnBesideStudio();

      await openPalette(/^Board/, 'Back to board');
      expect(studio()).toBeNull();
      expect(useAppStore.getState().currentSessionId).toBeNull();
      expect(currentDoors()).toEqual(['board']);

      await clickButton('New session');
      expect(currentDoors()).toEqual(['new']);
      expectHealthy();
    },
    JOURNEY_MS,
  );
});
