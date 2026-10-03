import { expect } from 'vitest';
import { StrictMode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { clearMocks } from '@tauri-apps/api/mocks';
import { ErrorBoundary } from '@goodboy/ui';
import { vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { StarredIssue, Workspace, WorkspaceId } from '@goodboy/types';
import { shortcutGlyphs, type ShortcutId } from '../../../shared/keyboard/registry';
import { agentPlace } from '../../../store';
import { selectOpenDrawer } from '../../../store/slices/drawer/selectOpenDrawer';
import { App } from '../../../App';
import { seedActivityRunScene } from '../../../app/components/MockScene/scenes/activityRunSeed';
import { seedResolveScene } from '../../../app/components/MockScene/scenes/resolveSeed';
import { pressShortcut } from '../../helpers/pressKey';
import { reloads, spawnedWindows, worldDatabase, zoomFactors } from './keys.effects';
import {
  type BridgeArgs,
  type Ctx,
  type Row,
  bridge,
  WAIT,
  both,
  clickButton,
  heading,
  lens,
  openCrumb,
  openPalette,
  settle,
  useAppStore,
  visible,
} from './harness';

const ANCHOR = /^Search or ask/;

const focusAnchor = async (): Promise<HTMLElement> => {
  const anchor = await screen.findByRole('button', { name: ANCHOR });
  anchor.focus();
  expect(document.activeElement).toBe(anchor);
  return anchor;
};

const pressed = async (id: ShortcutId, target?: Element): Promise<void> => {
  pressShortcut({ id, ...(target !== undefined && { target }) });
  await settle();
};

const hydrateBranches = (): void => {
  const state = useAppStore.getState();
  useAppStore.setState({
    sessionBranches: {
      ...state.sessionBranches,
      ...Object.fromEntries(
        Object.entries(state.sessionProjectMounts).flatMap(([sessionId, mounts]) => {
          const branch = mounts[0]?.branch;
          return branch === undefined || branch === null ? [] : [[sessionId, branch]];
        }),
      ),
    },
  });
};

const press = (id: ShortcutId) => async (): Promise<void> => {
  hydrateBranches();
  await focusAnchor();
  await pressed(id);
};

const keyRow = (row: {
  readonly id: ShortcutId;
  readonly also?: ReadonlyArray<ShortcutId>;
  readonly note?: string;
  readonly seed?: Row['seed'];
  readonly open: Row['open'];
  readonly lands: Row['lands'];
}): Row => ({
  name: `key ${row.id} (${shortcutGlyphs(row.id)})${row.note === undefined ? '' : `, ${row.note}`}`,
  covers: [row.id, ...(row.also ?? [])].map((id) => `key:${id}`),
  ...(row.seed !== undefined && { seed: row.seed }),
  open: row.open,
  lands: row.lands,
});

const pressRow = (row: {
  readonly id: ShortcutId;
  readonly note?: string;
  readonly seed?: Row['seed'];
  readonly lands: Row['lands'];
}): Row => keyRow({ ...row, open: press(row.id) });

const tab = async (name: RegExp, isSelected = true): Promise<void> => {
  expect(await screen.findByRole('tab', { name, selected: isSelected }, WAIT)).toBeDefined();
};

const drawerIs = (tabName: string | null) => async (ctx: Ctx) => {
  await waitFor(() => {
    const drawer = selectOpenDrawer(useAppStore.getState());
    expect(drawer?.kind).toBe('context');
    expect(drawer?.sessionId).toBe(ctx.sessionId);
    if (tabName !== null) {
      expect((drawer as { payload: { tab: string } }).payload.tab).toBe(tabName);
    }
  }, WAIT);
};

const WORKSPACE_NAMES = ['Northwind', 'Cascadia', 'Acme', 'Harborline Labs'] as const;

const seedWorkspaces = (): ReadonlyArray<Workspace> => {
  const state = useAppStore.getState();
  const current = state.workspaces[0];
  if (current === undefined) {
    throw new Error('the board seed has no workspace');
  }
  const others = WORKSPACE_NAMES.map((name, index): Workspace => ({
    ...current,
    id: `keys-workspace-${index}` as WorkspaceId,
    name,
    lastAccessedAt: `2026-09-0${index + 1}T10:00:00.000Z` as Workspace['lastAccessedAt'],
  }));
  useAppStore.setState({ workspaces: [...state.workspaces, ...others] });
  return others;
};

const switcherRowOf = (id: ShortcutId): HTMLElement | null => {
  const glyph = shortcutGlyphs(id);
  const pill = Array.from(document.querySelectorAll('kbd')).find(
    (candidate) => candidate.textContent === glyph,
  );
  return pill?.closest<HTMLElement>('div[class*="group"]') ?? null;
};

const DIGIT_IDS = [
  'workspace.1',
  'workspace.2',
  'workspace.3',
  'workspace.4',
  'workspace.5',
  'workspace.6',
  'workspace.7',
  'workspace.8',
  'workspace.9',
] as const satisfies ReadonlyArray<ShortcutId>;

export const KEY_ROWS: ReadonlyArray<Row> = [
  pressRow({
    id: 'palette.open',
    lands: () => tab(/^Commands/),
  }),
  pressRow({
    id: 'search.open',
    lands: () => tab(/^Search/),
  }),
  pressRow({
    id: 'settings.open',
    lands: () => heading('Settings'),
  }),
  pressRow({
    id: 'settings.shortcuts',
    lands: () => heading('Lists'),
  }),
  pressRow({
    id: 'report.open',
    lands: () => visible('dialog', /report|bug/i),
  }),
  keyRow({
    id: 'app.reload',
    open: async () => {
      reloads.length = 0;
      await press('app.reload')();
    },
    lands: async () => expect(reloads).toHaveLength(1),
  }),
  keyRow({
    id: 'zoom.in',
    open: async () => {
      zoomFactors.length = 0;
      await press('zoom.in')();
    },
    lands: async () => expect(zoomFactors.at(-1)).toBeCloseTo(1.1),
  }),
  keyRow({
    id: 'zoom.out',
    open: async () => {
      zoomFactors.length = 0;
      await press('zoom.out')();
    },
    lands: async () => expect(zoomFactors.at(-1)).toBeCloseTo(0.9),
  }),
  keyRow({
    id: 'zoom.reset',
    open: async () => {
      zoomFactors.length = 0;
      await press('zoom.in')();
      await press('zoom.reset')();
    },
    lands: async () => expect(zoomFactors.at(-1)).toBe(1),
  }),
  pressRow({
    id: 'workspace.switcher',
    lands: () => visible('textbox', 'Find a workspace or project'),
  }),
  keyRow({
    id: 'workspace.1',
    also: DIGIT_IDS.slice(1),
    note: 'all nine digits open the workspace the switcher numbers',
    open: async () => {
      seedWorkspaces();
      spawnedWindows.length = 0;
      await press('workspace.switcher')();
    },
    lands: async () => {
      await visible('textbox', 'Find a workspace or project');
      const wanted = ['Harborline Labs', 'Acme', 'Cascadia', 'Northwind'];
      for (const [index, name] of wanted.entries()) {
        const id = DIGIT_IDS[index] as ShortcutId;
        const row = switcherRowOf(id);
        expect(row?.textContent, `${shortcutGlyphs(id)} is printed on ${name}`).toContain(name);
        await pressed(id, document.body);
        const spawned = useAppStore
          .getState()
          .workspaces.find((workspace) => workspace.id === spawnedWindows.at(-1));
        expect(spawned?.name, `${shortcutGlyphs(id)} opens ${name}`).toBe(name);
      }
      expect(switcherRowOf(DIGIT_IDS[4])).toBeNull();
    },
  }),
  pressRow({
    id: 'column.toggle',
    lands: () => visible('button', /^Show sessions/),
  }),
  pressRow({
    id: 'session.board',
    lands: () => heading('Board'),
  }),
  keyRow({
    id: 'nav.back',
    open: async () => {
      await openCrumb(/^Agents/);
      await press('nav.back')();
    },
    lands: lens(null),
  }),
  keyRow({
    id: 'nav.forward',
    open: async () => {
      await openCrumb(/^Agents/);
      await press('nav.back')();
      await press('nav.forward')();
    },
    lands: lens('agents'),
  }),
  keyRow({
    id: 'session.next',
    open: async () => {
      await press('session.next')();
    },
    lands: async (ctx) => expect(useAppStore.getState().currentSessionId).not.toBe(ctx.sessionId),
  }),
  keyRow({
    id: 'session.prev',
    open: async () => {
      await press('session.prev')();
    },
    lands: async (ctx) => expect(useAppStore.getState().currentSessionId).not.toBe(ctx.sessionId),
  }),
  pressRow({
    id: 'session.delete',
    lands: async () => expect(await screen.findByText('Delete session?', {}, WAIT)).toBeDefined(),
  }),
  keyRow({
    id: 'lens.overview',
    open: async () => {
      await openCrumb(/^Agents/);
      await press('lens.overview')();
    },
    lands: lens(null),
  }),
  pressRow({ id: 'lens.workflows', lands: both(lens('workflows'), () => heading('Workflows')) }),
  pressRow({ id: 'lens.agents', lands: both(lens('agents'), () => heading('Agents')) }),
  pressRow({ id: 'lens.review', lands: both(lens('review'), () => heading('Review')) }),
  pressRow({ id: 'lens.questions', lands: both(lens('questions'), () => heading('Questions')) }),
  pressRow({ id: 'lens.files', lands: both(lens('files'), () => heading('Diff')) }),
  pressRow({ id: 'lens.plans', lands: both(lens('plans'), () => heading('Artifacts')) }),
  pressRow({ id: 'lens.scripts', lands: both(lens('scripts'), () => heading('Scripts')) }),
  pressRow({ id: 'lens.terminal', lands: both(lens('terminal'), () => heading('Terminal')) }),
  pressRow({
    id: 'lens.pr',
    lands: both(lens('pr'), () => heading(/Stop retried webhooks/)),
  }),
  pressRow({ id: 'lens.context', lands: drawerIs(null) }),
  pressRow({ id: 'lens.goal', lands: drawerIs('goal') }),
  pressRow({ id: 'lens.decisions', lands: drawerIs('decisions') }),
  pressRow({ id: 'lens.summary', lands: drawerIs('summary') }),
];

const STARRED_TITLES = [
  'Retried webhooks post a second credit',
  'Payout hold copy',
  'Ledger drift',
];

const starredIssue = (index: number): StarredIssue => {
  const workspaceId = useAppStore.getState().currentWorkspaceId as WorkspaceId;
  return {
    workspaceId,
    provider: 'linear',
    externalId: `keys-issue-${index}`,
    identifier: `HBL-50${index + 1}`,
    container: 'HBL',
    title: STARRED_TITLES[index] ?? 'Starred',
    url: `https://linear.example.test/HBL-50${index + 1}`,
    state: 'open',
    stateLabel: 'Todo',
    starredAt: `2026-09-0${index + 1}T10:00:00.000Z` as StarredIssue['starredAt'],
    refreshedAt: `2026-09-0${3 - index}T10:00:00.000Z` as StarredIssue['refreshedAt'],
  };
};

const seedInbox = async (): Promise<void> => {
  const workspaceId = useAppStore.getState().currentWorkspaceId as WorkspaceId;
  useAppStore.setState({
    starredIssues: { [workspaceId]: [0, 1, 2].map(starredIssue) },
  });
  await clickButton(/^Open the inbox/);
  await visible('region', 'Starred');
};

const inboxRows = (): ReadonlyArray<HTMLElement> =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-inbox-key]'));

const inboxRowButton = (identifier: string): HTMLElement => {
  const row = inboxRows().find((candidate) => candidate.textContent?.includes(identifier));
  const button = row?.querySelector('button') ?? null;
  if (button === null) {
    throw new Error(`the inbox lists no ${identifier}`);
  }
  return button;
};

const selectedIdentifier = (): string | undefined =>
  inboxRows()
    .find((row) => row.getAttribute('data-selected') === 'true')
    ?.textContent?.match(/HBL-\d+/)?.[0];

const inboxKey = (id: ShortcutId, target: () => Element = () => document.body): Row['open'] => {
  return async () => {
    await seedInbox();
    await pressed(id, target());
  };
};

const openUrls = (): ReadonlyArray<string> =>
  vi
    .mocked(invoke)
    .mock.calls.filter(([command]) => command === 'open_url')
    .map(([, args]) => String((args as { url: string }).url));

const withBranchlessSession = (ctx: Ctx): void => {
  const state = useAppStore.getState();
  useAppStore.setState({ sessionBranches: { ...state.sessionBranches, [ctx.sessionId]: '' } });
};

const connectTools = (): void => {
  const state = useAppStore.getState();
  const workspaceId = state.currentWorkspaceId as WorkspaceId;
  useAppStore.setState({
    workspaceIntegrations: {
      ...state.workspaceIntegrations,
      [workspaceId]: ['linear', 'gitlab', 'jira', 'slack'].map((provider) => ({
        id: `keys-${provider}`,
        workspaceId,
        provider,
        config: {},
      })) as unknown as (typeof state.workspaceIntegrations)[WorkspaceId],
    },
  });
};

const pressConnected =
  (id: ShortcutId): Row['open'] =>
  async () => {
    connectTools();
    await press(id)();
  };

export const MORE_KEY_ROWS: ReadonlyArray<Row> = [
  pressRow({
    id: 'session.new',
    lands: () => heading('New session'),
  }),
  keyRow({
    id: 'session.refresh',
    open: press('session.refresh'),
    lands: async (ctx) =>
      waitFor(() => expect(useAppStore.getState().sessionSyncing[ctx.sessionId]).toBe(true), WAIT),
  }),
  keyRow({
    id: 'session.linkWork',
    open: async () => {
      await settle();
      await pressed('session.linkWork', document.body);
    },
    lands: () => visible('dialog', 'Link work'),
  }),
  keyRow({
    id: 'lens.explore',
    open: async (ctx) => {
      withBranchlessSession(ctx);
      await settle();
      await focusAnchor();
      await pressed('lens.explore');
    },
    lands: both(lens('explore'), () => heading('Explore')),
  }),
  keyRow({
    id: 'lens.linear',
    open: pressConnected('lens.linear'),
    lands: lens('linear'),
  }),
  keyRow({
    id: 'lens.gitlab_issues',
    open: pressConnected('lens.gitlab_issues'),
    lands: lens('gitlab_issues'),
  }),
  keyRow({
    id: 'lens.jira_issues',
    open: pressConnected('lens.jira_issues'),
    lands: lens('jira_issues'),
  }),
  keyRow({
    id: 'lens.slack_threads',
    open: pressConnected('lens.slack_threads'),
    lands: lens('slack_threads'),
  }),
  keyRow({
    id: 'composer.submit',
    note: 'in the workspace switcher it opens the picked workspace in a new window',
    open: async () => {
      seedWorkspaces();
      spawnedWindows.length = 0;
      await press('workspace.switcher')();
      const field = await screen.findByRole('textbox', { name: 'Find a workspace or project' });
      field.focus();
      await pressed('composer.submit', field);
    },
    lands: async () => {
      await waitFor(() => expect(spawnedWindows).toHaveLength(1), WAIT);
      expect(
        useAppStore.getState().workspaces.find((workspace) => workspace.id === spawnedWindows[0])
          ?.name,
      ).toBe('Harborline Labs');
    },
  }),
  keyRow({
    id: 'list.next',
    open: async () => {
      await seedInbox();
      const first = inboxRowButton('HBL-501');
      first.focus();
      await pressed('list.next', first);
    },
    lands: async () => expect(selectedIdentifier()).toBe('HBL-502'),
  }),
  keyRow({
    id: 'list.previous',
    open: async () => {
      await seedInbox();
      const first = inboxRowButton('HBL-501');
      first.focus();
      await pressed('list.next', first);
      await pressed('list.next', first);
      await pressed('list.previous', first);
    },
    lands: async () => expect(selectedIdentifier()).toBe('HBL-502'),
  }),
  keyRow({
    id: 'list.open',
    open: inboxKey('list.open'),
    lands: () => visible('dialog', 'Launch a session'),
  }),
  keyRow({
    id: 'list.openInTool',
    open: inboxKey('list.openInTool'),
    lands: async () =>
      waitFor(() => expect(openUrls()).toContain('https://linear.example.test/HBL-501'), WAIT),
  }),
  keyRow({
    id: 'list.reply',
    open: inboxKey('list.reply'),
    lands: async () =>
      waitFor(() => expect(document.activeElement?.tagName).toBe('TEXTAREA'), WAIT),
  }),
  keyRow({
    id: 'list.star',
    open: inboxKey('list.star'),
    lands: async () =>
      waitFor(() => {
        const removals = vi
          .mocked(invoke)
          .mock.calls.filter(([command]) => command === 'db_execute')
          .map(([, args]) => args as { sql: string; params: ReadonlyArray<unknown> })
          .filter((call) => /DELETE FROM workspace_starred_issues/.test(call.sql));
        expect(removals).toHaveLength(1);
        expect(removals[0]?.params).toContain('keys-issue-0');
      }, WAIT),
  }),
  keyRow({
    id: 'list.search',
    open: inboxKey('list.search'),
    lands: async () =>
      expect(document.activeElement).toBe(
        screen.getByRole('textbox', { name: 'Search the inbox' }),
      ),
  }),
];

export type WorldRow = {
  readonly name: string;
  readonly covers: ReadonlyArray<string>;
  readonly world: 'resolve' | 'run';
  readonly open: () => Promise<void>;
  readonly lands: () => Promise<void>;
};

const WORLDS: Readonly<Record<WorldRow['world'], () => void>> = {
  resolve: () => seedResolveScene({ expandedThreadId: null }),
  run: () => seedActivityRunScene(),
};

export const bootWorld = async ({
  world,
}: {
  readonly world: WorldRow['world'];
}): Promise<void> => {
  worldDatabase.answersEmpty = world === 'resolve';
  const { navigate } = useAppStore.getState();
  WORLDS[world]();
  useAppStore.setState({ navigate });
  clearMocks();
  Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
  const state = useAppStore.getState();
  useAppStore.setState({
    sessionBranches: {
      ...state.sessionBranches,
      ...Object.fromEntries(
        Object.entries(state.sessionProjectMounts).flatMap(([sessionId, mounts]) => {
          const branch = mounts[0]?.branch;
          return branch === undefined || branch === null ? [] : [[sessionId, branch]];
        }),
      ),
      ...(state.currentSessionId === null
        ? {}
        : { [state.currentSessionId]: state.sessionBranches[state.currentSessionId] ?? 'hl/keys' }),
    },
    hydrate: async () => undefined,
    checkForUpdates: async () => undefined,
    hydrated: true,
    bootPhase: 'ready',
  } as never);
  render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
  await settle(6);
};

const worldRow = (row: {
  readonly id: ShortcutId;
  readonly also?: ReadonlyArray<ShortcutId>;
  readonly world: WorldRow['world'];
  readonly note?: string;
  readonly open: WorldRow['open'];
  readonly lands: WorldRow['lands'];
}): WorldRow => ({
  name: `key ${row.id} (${shortcutGlyphs(row.id)}), ${row.world} world${row.note === undefined ? '' : `, ${row.note}`}`,
  covers: [row.id, ...(row.also ?? [])].map((id) => `key:${id}`),
  world: row.world,
  open: row.open,
  lands: row.lands,
});

const THREADS = {
  typo: 'PRRT_thread_typo',
  metrics: 'PRRT_thread_retry_metrics',
  constant: 'PRRT_thread_retry_constant',
  skipped: 'PRRT_thread_flaky_test',
} as const;

const threadRow = (threadId: string): HTMLElement => {
  const row = document.querySelector<HTMLElement>(`[data-thread-id="${threadId}"]`);
  if (row === null) {
    throw new Error(`the review lists no ${threadId}`);
  }
  return row;
};

const openReview = async (): Promise<void> => {
  await press('lens.review')();
  await visible('tab', /^Comments/);
};

const focusThread = async (threadId: string): Promise<HTMLElement> => {
  const row = threadRow(threadId);
  fireEvent.click(row);
  await settle();
  const current = threadRow(threadId);
  current.focus();
  return current;
};

const reviewKey =
  (id: ShortcutId, threadId: string): WorldRow['open'] =>
  async () => {
    await openReview();
    const row = await focusThread(threadId);
    await pressed(id, row);
  };

const currentThread = (): string | null =>
  document.querySelector('[data-thread-id][aria-current="true"]')?.getAttribute('data-thread-id') ??
  null;

const resolveIdsOf = (threadId: string): ReadonlyArray<string> => {
  const state = useAppStore.getState();
  const items =
    state.currentSessionId === null
      ? []
      : (state.sessionResolveQueueItems[state.currentSessionId] ?? []);
  return [
    threadId,
    ...items.filter((entry) => entry.item.threadId === threadId).map((entry) => entry.item.id),
  ];
};

const resolveWrites = (threadId: string): number => {
  const ids = resolveIdsOf(threadId);
  return vi
    .mocked(invoke)
    .mock.calls.filter(([command]) => command === 'db_execute')
    .map(([, args]) => args as { sql: string; params: ReadonlyArray<unknown> })
    .filter((call) => /resolve_/.test(call.sql) && ids.some((id) => call.params.includes(id)))
    .length;
};

let writesBefore = 0;

const writesAfter = (threadId: string) => async (): Promise<void> =>
  waitFor(() => expect(resolveWrites(threadId)).toBeGreaterThan(writesBefore), WAIT);

const reviewWrite =
  (id: ShortcutId, threadId: string): WorldRow['open'] =>
  async () => {
    await openReview();
    const row = await focusThread(threadId);
    writesBefore = resolveWrites(threadId);
    await pressed(id, row);
  };

export const WORLD_ROWS: ReadonlyArray<WorldRow> = [
  worldRow({
    id: 'review.next',
    world: 'resolve',
    open: reviewKey('review.next', THREADS.metrics),
    lands: async () => waitFor(() => expect(currentThread()).toBe(THREADS.constant), WAIT),
  }),
  worldRow({
    id: 'review.previous',
    world: 'resolve',
    open: reviewKey('review.previous', THREADS.metrics),
    lands: async () => waitFor(() => expect(currentThread()).not.toBe(THREADS.metrics), WAIT),
  }),
  worldRow({
    id: 'review.view',
    world: 'resolve',
    open: async () => {
      await openReview();
      await pressed('review.view', await focusThread(THREADS.metrics));
    },
    lands: () => tab(/^Commits/),
  }),
  worldRow({
    id: 'review.select',
    world: 'resolve',
    open: reviewKey('review.select', THREADS.constant),
    lands: () => visible('toolbar', 'Selected comments'),
  }),
  worldRow({
    id: 'review.selectAll',
    world: 'resolve',
    open: async () => {
      await openReview();
      await pressed('review.selectAll', await focusThread(THREADS.metrics));
    },
    lands: () => visible('toolbar', 'Selected comments'),
  }),
  worldRow({
    id: 'review.fix',
    world: 'resolve',
    open: reviewKey('review.fix', THREADS.constant),
    lands: () => visible('region', 'Fix launch'),
  }),
  worldRow({
    id: 'review.skip',
    world: 'resolve',
    open: reviewWrite('review.skip', THREADS.constant),
    lands: writesAfter(THREADS.constant),
  }),
  worldRow({
    id: 'review.undo',
    world: 'resolve',
    note: 'resumes a skipped comment',
    open: reviewWrite('review.undo', THREADS.skipped),
    lands: writesAfter(THREADS.skipped),
  }),
  worldRow({
    id: 'review.reply',
    world: 'resolve',
    open: reviewKey('review.reply', THREADS.metrics),
    lands: async () =>
      waitFor(() => expect(document.activeElement?.tagName).toBe('TEXTAREA'), WAIT),
  }),
  worldRow({
    id: 'review.edit',
    world: 'resolve',
    open: reviewKey('review.edit', THREADS.metrics),
    lands: async () =>
      waitFor(() => expect(document.activeElement?.tagName).toBe('TEXTAREA'), WAIT),
  }),
  worldRow({
    id: 'activity.openRun',
    world: 'run',
    open: async () => {
      await settle(4);
      const lane = Array.from(
        document.querySelectorAll<HTMLElement>('button[aria-keyshortcuts="Shift+Enter"]'),
      ).find((button) => /Open run/.test(button.textContent ?? ''));
      if (lane === undefined) {
        throw new Error('the activity feed has no run row');
      }
      lane.focus();
      await pressed('activity.openRun', lane);
    },
    lands: async () =>
      waitFor(
        () => expect(Object.values(useAppStore.getState().activeLens)).toContain('workflows'),
        WAIT,
      ),
  }),
];

const QUEUE_SELECT = /FROM resolve_queue_items q/;

const queueRows = (sessionId: string): ReadonlyArray<Record<string, unknown>> => {
  const entries = useAppStore.getState().sessionResolveQueueItems[sessionId as never] ?? [];
  return entries.map(({ item, thread }) => ({
    ...item,
    threadRowId: thread.id,
    projectId: thread.projectId,
    prNumber: thread.prNumber,
    originKind: thread.originKind,
    diffCommentId: thread.diffCommentId,
    state: thread.state,
    stage: thread.stage,
    stateReason: thread.stateReason,
    revision: thread.revision,
    threadGeneration: thread.generation,
    threadReopenedFromThreadId: thread.reopenedFromThreadId,
    activeAttemptId: thread.activeAttemptId,
    disposition: thread.disposition,
    replyDraft: thread.replyDraft,
    commitShas: thread.commitShas === null ? null : JSON.stringify(thread.commitShas),
    fixupOfSha: thread.fixupOfSha,
    replacesSha: thread.replacesSha,
    question: thread.question,
    replyPostedAt: thread.replyPostedAt,
    replyId: thread.replyId,
    githubResolved: thread.githubResolved === null ? null : thread.githubResolved ? 1 : 0,
    closedAt: thread.closedAt,
    closedSource: thread.closedSource,
    threadCreatedAt: thread.createdAt,
    threadUpdatedAt: thread.updatedAt,
  }));
};

const KEYS_DIFF = [
  'diff --git a/src/ledger.ts b/src/ledger.ts',
  'index 1111111..2222222 100644',
  '--- a/src/ledger.ts',
  '+++ b/src/ledger.ts',
  '@@ -1,3 +1,4 @@',
  ' export const credit = 1;',
  '+export const retryCredit = 2;',
  ' export const debit = 3;',
  ' export const total = 4;',
  'diff --git a/src/notify.ts b/src/notify.ts',
  'index 3333333..4444444 100644',
  '--- a/src/notify.ts',
  '+++ b/src/notify.ts',
  '@@ -1,2 +1,3 @@',
  ' export const channel = 1;',
  '+export const backoff = 2;',
  ' export const retries = 3;',
  'diff --git a/src/payout.ts b/src/payout.ts',
  'index 5555555..6666666 100644',
  '--- a/src/payout.ts',
  '+++ b/src/payout.ts',
  '@@ -1,2 +1,3 @@',
  ' export const hold = 1;',
  '+export const delay = 2;',
  ' export const release = 3;',
  '',
].join('\n');

export const keysBridge = (command: string, args?: BridgeArgs): Promise<unknown> => {
  if (command === 'worktree_diff') {
    return Promise.resolve(KEYS_DIFF);
  }
  if (command === 'db_select' && QUEUE_SELECT.test(args?.sql ?? '')) {
    const sessionId = useAppStore.getState().currentSessionId;
    return Promise.resolve(sessionId === null ? [] : queueRows(sessionId));
  }
  if (command === 'db_select' && worldDatabase.answersEmpty) {
    return Promise.resolve([]);
  }
  return bridge(command, args);
};

const standaloneAgent = (ctx: Ctx): string => {
  const agent = (useAppStore.getState().sessionPhaseRuns[ctx.sessionId] ?? []).find(
    (candidate) => candidate.workflowRunId == null && candidate.deletedAt == null,
  );
  if (agent === undefined) {
    throw new Error('the seeded session has no standalone agent');
  }
  return agent.id;
};

const composerKeys: { last: KeyboardEvent | null } = { last: null };

const openAgentChat = async (ctx: Ctx): Promise<HTMLElement> => {
  hydrateBranches();
  useAppStore.getState().navigate({
    to: agentPlace({ sessionId: ctx.sessionId, agentId: standaloneAgent(ctx) as never }),
  });
  await settle();
  const composer = await screen.findByPlaceholderText(/^What should .* build\?/, undefined, WAIT);
  composer.focus();
  return composer;
};

const dbWrites = (
  pattern: RegExp,
): ReadonlyArray<{ sql: string; params: ReadonlyArray<unknown> }> =>
  vi
    .mocked(invoke)
    .mock.calls.filter(([command]) => command === 'db_execute')
    .map(([, args]) => args as { sql: string; params: ReadonlyArray<unknown> })
    .filter((call) => pattern.test(call.sql));

const sidebarRow = async (ctx: Ctx): Promise<HTMLElement> => {
  await waitFor(
    () => expect(document.querySelector(`[data-select-id="${ctx.sessionId}"]`)).not.toBeNull(),
    WAIT,
  );
  return document.querySelector(`[data-select-id="${ctx.sessionId}"]`) as HTMLElement;
};

const emitTwoNotifications = async (): Promise<void> => {
  const { emitNotification } = useAppStore.getState();
  void emitNotification({ kind: 'summarizer-degraded', severity: 'warning', title: 'First alert' });
  await new Promise((resolve) => setTimeout(resolve, 5));
  void emitNotification({
    kind: 'summarizer-degraded',
    severity: 'warning',
    title: 'Second alert',
  });
  await settle();
};

const findStatus = (): HTMLElement | null => screen.queryByTestId('find-in-view');

const findSummary = (): string => findStatus()?.textContent ?? '';

type FindPosition = {
  readonly index: number;
  readonly total: number;
};

const findPosition = (): FindPosition | null => {
  const match = /(\d+) of (\d+)/.exec(findSummary());
  return match === null ? null : { index: Number(match[1]), total: Number(match[2]) };
};

let firstFindIndex = 0;

const rememberSearch = (text: string): void => {
  useAppStore.setState({ lastSearchText: text });
};

const openDiff = async (): Promise<void> => {
  await press('lens.files')();
  expect(
    await screen.findByRole('button', { name: /branch vs main · 3 files/ }, WAIT),
  ).toBeDefined();
};

const activeJumpFile = async (): Promise<string> => {
  await pressed('diff.jump', document.body);
  await visible('dialog', 'Jump to file');
  return document.querySelector('[data-active]')?.textContent ?? '';
};

let terminalTabCount = 0;

export const SESSION_KEY_ROWS: ReadonlyArray<Row> = [
  keyRow({
    id: 'terminal.newTab',
    open: async () => {
      await press('lens.terminal')();
      await clickButton('New terminal');
      const [first] = await screen.findAllByRole('tab', undefined, WAIT);
      expect(first).toBeDefined();
      (first as HTMLElement).focus();
      terminalTabCount = screen.getAllByRole('tab').length;
      await pressed('terminal.newTab', first as HTMLElement);
    },
    lands: async () =>
      waitFor(() => expect(screen.getAllByRole('tab').length).toBe(terminalTabCount + 1), WAIT),
  }),
  keyRow({
    id: 'diff.jump',
    open: async () => {
      await openDiff();
      await pressed('diff.jump', document.body);
    },
    lands: () => visible('dialog', 'Jump to file'),
  }),
  keyRow({
    id: 'diff.nextFile',
    open: async () => {
      await openDiff();
      await pressed('diff.nextFile', document.body);
    },
    lands: async () => expect(await activeJumpFile()).toContain('notify.ts'),
  }),
  keyRow({
    id: 'diff.previousFile',
    open: async () => {
      await openDiff();
      await pressed('diff.nextFile', document.body);
      await pressed('diff.nextFile', document.body);
      await pressed('diff.previousFile', document.body);
    },
    lands: async () => expect(await activeJumpFile()).toContain('notify.ts'),
  }),
  keyRow({
    id: 'session.model',
    open: async (ctx) => {
      const composer = await openAgentChat(ctx);
      await pressed('session.model', composer);
    },
    lands: () => visible('dialog', 'Model routing'),
  }),
  keyRow({
    id: 'session.permissions',
    open: async (ctx) => {
      const composer = await openAgentChat(ctx);
      await pressed('session.permissions', composer);
    },
    lands: () => visible('dialog', 'Permission mode'),
  }),
  keyRow({
    id: 'composer.newLine',
    open: async (ctx) => {
      const composer = await openAgentChat(ctx);
      fireEvent.change(composer, { target: { value: 'Map the retry budget' } });
      composerKeys.last = pressShortcut({ id: 'composer.newLine', target: composer });
      await settle();
    },
    lands: async () => {
      const composer = await screen.findByRole('textbox', { name: 'Message to the agent' });
      expect(composer).toHaveProperty('value', 'Map the retry budget');
      expect(composerKeys.last?.defaultPrevented).toBe(false);
    },
  }),
  keyRow({
    id: 'composer.send',
    open: async (ctx) => {
      const composer = await openAgentChat(ctx);
      fireEvent.change(composer, { target: { value: 'Map the retry budget' } });
      composerKeys.last = pressShortcut({ id: 'composer.send', target: composer });
      await settle();
    },
    lands: async () => {
      expect(composerKeys.last?.defaultPrevented).toBe(true);
      expect(
        screen
          .getByRole('textbox', { name: 'Message to the agent' })
          .getAttribute('data-prompt-kind'),
      ).toBe('message');
    },
  }),
  keyRow({
    id: 'menu.open',
    open: async (ctx) => {
      const row = await sidebarRow(ctx);
      const target = row.querySelector('button') ?? row;
      (target as HTMLElement).focus();
      await pressed('menu.open', target);
    },
    lands: () => visible('menu', /./),
  }),
  keyRow({
    id: 'session.archive',
    open: async (ctx) => {
      expect(
        dbWrites(/UPDATE sessions/).filter((call) => call.params.includes(ctx.sessionId)),
      ).toHaveLength(0);
      await press('session.archive')();
    },
    lands: async (ctx) =>
      waitFor(
        () =>
          expect(
            dbWrites(/archived_at/).filter((call) => call.params.includes(ctx.sessionId)).length,
          ).toBeGreaterThan(0),
        WAIT,
      ),
  }),
  keyRow({
    id: 'find.next',
    open: async () => {
      rememberSearch('credit');
      await focusAnchor();
      await pressed('find.next');
    },
    lands: async () => {
      await waitFor(() => expect(findStatus()).not.toBeNull(), WAIT);
      expect(findSummary()).toMatch(/“credit”.*1 of \d+/);
    },
  }),
  keyRow({
    id: 'find.previous',
    open: async () => {
      rememberSearch('credit');
      await focusAnchor();
      await pressed('find.next');
      await waitFor(() => expect(findPosition()).not.toBeNull(), WAIT);
      const first = findPosition() as FindPosition;
      await pressed('find.next');
      await waitFor(
        () => expect(findPosition()?.index).toBe((first.index % first.total) + 1),
        WAIT,
      );
      firstFindIndex = first.index;
      await pressed('find.previous');
    },
    lands: async () => waitFor(() => expect(findPosition()?.index).toBe(firstFindIndex), WAIT),
  }),
  keyRow({
    id: 'list.dismiss',
    open: async () => {
      await emitTwoNotifications();
      await openPalette(/^Notifications/);
      await visible('button', 'Second alert');
      await pressed('list.next', document.body);
      await pressed('list.dismiss', document.body);
    },
    lands: async () => {
      await waitFor(() => expect(screen.queryByText('Second alert')).toBeNull(), WAIT);
      expect(screen.getByText('First alert')).toBeDefined();
    },
  }),
];
