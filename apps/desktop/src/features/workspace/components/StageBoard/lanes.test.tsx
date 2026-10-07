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
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { aProject, aSession, aWorkspace } from '@goodboy/types/testing';
import type {
  AgentId,
  IsoDateTime,
  OpenQuestion,
  OpenQuestionId,
  ProviderRunId,
  Session,
  WorkspaceGitStatus,
} from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import { installFakeResizeObserver } from '../../../../test/fakeResizeObserver';
import { StageBoard } from './index';

const workspace = aWorkspace({ name: 'Harborline', slug: 'harborline' });
const project = aProject({ workspaceId: workspace.id, name: 'ledger-core', kind: 'folder' });

const NOW = '2026-10-07T09:00:00.000Z' as IsoDateTime;

const LANES = ['building', 'running', 'needs you', 'in review', 'done', 'archived'] as const;

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
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const sessionOf = (goal: string, over: Partial<Session> = {}): Session =>
  aSession({ workspaceId: workspace.id, goal, ...over });

const mergedGithub = (number: number) => ({
  fetchedAt: NOW,
  pr: {
    number,
    title: `Change ${number}`,
    url: `https://example.invalid/harborline/pull/${number}`,
    state: 'merged' as const,
    mergeable: null,
    checks: 'success' as const,
    baseBranch: 'main',
    headBranch: `hl/change-${number}`,
    isDraft: false,
    reviewDecision: null,
    body: '',
    updatedAt: NOW,
  },
  linkedIssues: [],
  failedAt: null,
  loading: false,
  error: null,
  detail: null,
  detailFetchedAt: null,
  detailLoading: false,
  detailError: null,
});

const archivedOf = (goal: string): Session =>
  sessionOf(goal, { archivedAt: NOW, state: { kind: 'ended', endedAt: NOW } });

type Seed = {
  readonly active?: ReadonlyArray<Session>;
  readonly done?: ReadonlyArray<Session>;
  readonly archived?: ReadonlyArray<Session> | null;
};

const seed = ({ active = [], done = [], archived = [] }: Seed) => {
  useAppStore.setState({
    workspaces: [workspace],
    projects: [project],
    sessions: [...active, ...done],
    archivedSessions: archived === null ? {} : { [workspace.id]: [...archived] },
    sessionGithub: Object.fromEntries(
      done.map((session, index) => [session.id, mergedGithub(100 + index)]),
    ),
    boardReady: true,
    currentWorkspaceId: workspace.id,
    loadArchivedSessions:
      archived === null ? () => new Promise<void>(() => undefined) : async () => undefined,
  });
};

const mountBoard = (sessions: ReadonlyArray<Session>) =>
  render(
    <ToastProvider>
      <StageBoard workspaceId={workspace.id} sessions={sessions} />
    </ToastProvider>,
  );

const lane = (name: (typeof LANES)[number]): HTMLElement => screen.getByRole('group', { name });

const lanesInOrder = (): ReadonlyArray<string> =>
  screen
    .getAllByRole('group')
    .map((group) => group.getAttribute('aria-label') ?? '')
    .filter((name) => (LANES as ReadonlyArray<string>).includes(name));

const boxOf = (width: number): DOMRect =>
  ({
    left: 0,
    top: 0,
    width,
    height: 800,
    right: width,
    bottom: 800,
    x: 0,
    y: 0,
  }) as DOMRect;

const measureBoard = ({ width }: { readonly width: number }) => {
  const observers = installFakeResizeObserver();
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(() => boxOf(width));
  return observers;
};

const openQuestionOf = (session: Session): OpenQuestion => ({
  id: `question-${session.id}` as OpenQuestionId,
  sessionId: session.id,
  createdByAgentId: 'agent-1' as AgentId,
  text: 'Which export format should the settlement file use?',
  suggestedAnswers: [],
  isBlocking: false,
  userAnswer: null,
  status: 'open',
  createdAt: session.createdAt,
});

describe('StageBoard lanes', () => {
  it('always renders the six lanes in pipeline order, Done and Archived included, with no dock', () => {
    const building = sessionOf('Add idempotency keys to the refund endpoint');
    seed({ active: [building] });
    const { container } = mountBoard([building]);

    expect(lanesInOrder()).toEqual([...LANES]);
    expect(container.querySelector('[data-board-dock]')).toBeNull();
    expect(screen.queryByRole('button', { name: /Collapse/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^(Done|Archived), \d+ sessions?$/ })).toBeNull();
  });

  it('gives Done and Archived their own empty line when they hold nothing', () => {
    const building = sessionOf('Add idempotency keys to the refund endpoint');
    seed({ active: [building] });
    mountBoard([building]);

    expect(within(lane('done')).getByText('Nothing done yet')).toBeDefined();
    expect(within(lane('archived')).getByText('Nothing archived')).toBeDefined();
    expect(within(lane('running')).getByText('No agent running')).toBeDefined();
    expect(within(lane('needs you')).getByText('Nothing needs you')).toBeDefined();
    expect(within(lane('in review')).getByText('Nothing in review')).toBeDefined();
    expect(within(lane('building')).queryByText('Nothing in progress')).toBeNull();
  });

  it('hides a zero count in a lane header and shows a real one', () => {
    const building = sessionOf('Add idempotency keys to the refund endpoint');
    const second = sessionOf('Retry webhook delivery with backoff');
    seed({ active: [building, second] });
    mountBoard([building, second]);

    expect(within(lane('building')).getByText('2')).toBeDefined();
    expect(within(lane('done')).queryByText('0')).toBeNull();
    expect(within(lane('archived')).queryByText('0')).toBeNull();
  });

  it('shows the Done and Archived cards in place without a click', () => {
    const building = sessionOf('Add idempotency keys to the refund endpoint');
    const merged = sessionOf('Bump the lockfile after the security patch');
    const shelved = archivedOf('Update the refund macros for support');
    seed({ active: [building], done: [merged], archived: [shelved] });
    mountBoard([building, merged]);

    expect(within(lane('done')).getByRole('button', { name: merged.goal })).toBeDefined();
    expect(within(lane('archived')).getByRole('button', { name: shelved.goal })).toBeDefined();
    expect(within(lane('archived')).getByRole('button', { name: /Restore/ })).toBeDefined();
  });

  it('ignores a collapse value an older version stored', () => {
    localStorage.setItem(
      `goodboy:board-collapsed:v1:${workspace.id}`,
      JSON.stringify({ done: true, archived: true }),
    );
    const building = sessionOf('Add idempotency keys to the refund endpoint');
    const shelved = archivedOf('Update the refund macros for support');
    seed({ active: [building], archived: [shelved] });
    mountBoard([building]);

    expect(within(lane('archived')).getByRole('button', { name: shelved.goal })).toBeDefined();
  });

  it('shows a muted Loading line in Archived until the list answers, then its empty line', () => {
    const building = sessionOf('Add idempotency keys to the refund endpoint');
    seed({ active: [building], archived: null });
    mountBoard([building]);

    expect(within(lane('archived')).getByText('Loading')).toBeDefined();
    expect(within(lane('archived')).queryByText('Nothing archived')).toBeNull();
    expect(within(lane('done')).getByText('Nothing done yet')).toBeDefined();

    act(() => useAppStore.setState({ archivedSessions: { [workspace.id]: [] } }));

    expect(within(lane('archived')).queryByText('Loading')).toBeNull();
    expect(within(lane('archived')).getByText('Nothing archived')).toBeDefined();
  });

  it('files a running session with an open question under Needs you, not Running', () => {
    const asking = sessionOf('Fix the rounding drift in the settlement export', {
      state: { kind: 'running', runId: 'run-1' as ProviderRunId, startedAt: NOW },
    });
    const working = sessionOf('Nightly reconciliation before the Monday close', {
      state: { kind: 'running', runId: 'run-2' as ProviderRunId, startedAt: NOW },
    });
    seed({ active: [asking, working] });
    useAppStore.setState({ sessionOpenQuestions: { [asking.id]: [openQuestionOf(asking)] } });
    mountBoard([asking, working]);

    expect(within(lane('needs you')).getByRole('button', { name: asking.goal })).toBeDefined();
    expect(within(lane('running')).queryByRole('button', { name: asking.goal })).toBeNull();
    expect(within(lane('running')).getByRole('button', { name: working.goal })).toBeDefined();
  });

  it('puts Done above Archived in one lane when six do not fit, each half with its own empty line', () => {
    const building = sessionOf('Add idempotency keys to the refund endpoint');
    seed({ active: [building] });
    const observers = measureBoard({ width: 1200 });
    mountBoard([building]);
    act(() => observers.resizeAll());

    const done = lane('done');
    const archived = lane('archived');
    expect(done.parentElement).toBe(archived.parentElement);
    expect(Array.from(done.parentElement?.children ?? [])).toEqual([done, archived]);
    expect(lanesInOrder()).toEqual([...LANES]);
    expect(within(done).getByText('Nothing done yet')).toBeDefined();
    expect(within(archived).getByText('Nothing archived')).toBeDefined();
  });

  it('gives Done and Archived a lane each once six lanes fit, and keeps the order below that', () => {
    const building = sessionOf('Add idempotency keys to the refund endpoint');
    seed({ active: [building] });
    const observers = measureBoard({ width: 1440 });
    mountBoard([building]);
    act(() => observers.resizeAll());

    expect(lane('done').parentElement).toBe(lane('building').parentElement);
    expect(lane('archived').parentElement).toBe(lane('building').parentElement);
    expect(lanesInOrder()).toEqual([...LANES]);
  });

  it('centres a very wide board the same way: six lanes, Done and Archived beside the rest', () => {
    const building = sessionOf('Add idempotency keys to the refund endpoint');
    seed({ active: [building] });
    const observers = measureBoard({ width: 2560 });
    mountBoard([building]);
    act(() => observers.resizeAll());

    expect(lane('archived').parentElement).toBe(lane('building').parentElement);
    expect(lanesInOrder()).toEqual([...LANES]);
  });

  it('keeps every lane when the window shrinks below five lanes and the board scrolls', () => {
    const building = sessionOf('Add idempotency keys to the refund endpoint');
    seed({ active: [building] });
    const observers = measureBoard({ width: 900 });
    mountBoard([building]);
    act(() => observers.resizeAll());

    expect(lanesInOrder()).toEqual([...LANES]);
    expect(lane('done').parentElement).toBe(lane('archived').parentElement);
  });
});

describe('StageBoard header', () => {
  type Changes = {
    readonly unstaged?: number;
    readonly untracked?: number;
    readonly changed?: number;
  };

  const statusOf = (changes: Changes): WorkspaceGitStatus => ({
    state: 'ready',
    branch: 'main',
    headSubject: 'Bump the lockfile after the security patch',
    upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
    workingTree: {
      kind: 'known',
      staged: 0,
      unstaged: 0,
      untracked: 0,
      unmerged: 0,
      changed: 0,
      ...changes,
    },
    upstream: 'origin/main',
    inProgress: null,
  });

  it('reads the repo summary as quiet text after the title, with the filter and New session on the right', () => {
    const building = sessionOf('Add idempotency keys to the refund endpoint');
    const repos = ['payments-api', 'notify-relay', 'ledger-core'].map((name) =>
      aProject({ workspaceId: workspace.id, name, kind: 'repo', rootPath: `/tmp/${name}` }),
    );
    seed({ active: [building] });
    useAppStore.setState({
      projects: repos,
      projectGitStatus: {
        [repos[0]?.id ?? '']: statusOf({}),
        [repos[1]?.id ?? '']: statusOf({ unstaged: 1, changed: 1 }),
        [repos[2]?.id ?? '']: statusOf({ untracked: 3, changed: 3 }),
      },
      loadProjectGitStatus: async () => undefined,
    });
    mountBoard([building]);

    const title = screen.getByRole('heading', { level: 1, name: 'Board' });
    const chip = screen.getByRole('button', { name: '3 repository git statuses' });
    const newSession = screen.getByRole('button', { name: 'New session' });

    expect(title.compareDocumentPosition(chip) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(chip.compareDocumentPosition(newSession) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(title.parentElement?.contains(chip)).toBe(true);
    expect(newSession.parentElement?.contains(chip)).toBe(false);
    expect(within(chip).getByText('3 repos')).toBeDefined();
    expect(within(chip).getByText(/uncommitted$/)).toBeDefined();
  });
});

describe('StageBoard selection over every lane', () => {
  const checkboxesIn = (name: (typeof LANES)[number]) =>
    within(lane(name)).getAllByRole('checkbox');

  const doneCards = (count: number): ReadonlyArray<Session> =>
    Array.from({ length: count }, (_, index) =>
      sessionOf(`Ship the settlement change ${index + 1}`),
    );

  const toolbar = (): HTMLElement => screen.getByRole('toolbar');

  it('selects sixty Done cards and every other card with Select all', () => {
    const building = [sessionOf('Add idempotency keys to the refund endpoint')];
    const done = doneCards(60);
    const shelved = [archivedOf('Update the refund macros for support')];
    seed({ active: building, done, archived: shelved });
    mountBoard([...building, ...done]);

    fireEvent.click(checkboxesIn('building')[0] as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: 'Select all 62' }));

    expect(within(toolbar()).getByText('62 selected')).toBeDefined();
    expect(
      checkboxesIn('done').filter((box) => box.getAttribute('aria-checked') === 'true'),
    ).toHaveLength(60);
    expect(checkboxesIn('archived')[0]?.getAttribute('aria-checked')).toBe('true');
  });

  it('extends a Shift range from the Done half into the Archived half of the stacked lane', () => {
    const done = doneCards(3);
    const shelved = [
      archivedOf('Update the refund macros for support'),
      archivedOf('Fix a flaky export test'),
    ];
    seed({ done, archived: shelved });
    const observers = measureBoard({ width: 1200 });
    mountBoard(done);
    act(() => observers.resizeAll());

    const doneBoxes = checkboxesIn('done');
    const archivedBoxes = checkboxesIn('archived');
    fireEvent.click(doneBoxes[1] as HTMLElement);
    fireEvent.click(archivedBoxes[0] as HTMLElement, { shiftKey: true });

    expect(within(toolbar()).getByText('3 selected')).toBeDefined();
    expect(doneBoxes[0]?.getAttribute('aria-checked')).toBe('false');
    expect(doneBoxes[1]?.getAttribute('aria-checked')).toBe('true');
    expect(doneBoxes[2]?.getAttribute('aria-checked')).toBe('true');
    expect(archivedBoxes[0]?.getAttribute('aria-checked')).toBe('true');
    expect(archivedBoxes[1]?.getAttribute('aria-checked')).toBe('false');
  });

  it('offers Archive for the active cards and Restore for the archived ones in one selection', () => {
    const done = doneCards(1);
    const shelved = [archivedOf('Update the refund macros for support')];
    seed({ done, archived: shelved });
    mountBoard(done);

    fireEvent.click(checkboxesIn('done')[0] as HTMLElement);
    fireEvent.click(checkboxesIn('archived')[0] as HTMLElement, { metaKey: true });

    expect(within(toolbar()).getByText('2 selected')).toBeDefined();
    expect(within(toolbar()).getByRole('button', { name: 'Archive 1 session' })).toBeDefined();
    expect(within(toolbar()).getByRole('button', { name: 'Restore 1 session' })).toBeDefined();
    expect(within(toolbar()).getByRole('button', { name: 'Delete 2 sessions' })).toBeDefined();
  });
});
