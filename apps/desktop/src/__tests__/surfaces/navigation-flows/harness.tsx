import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { StrictMode } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ErrorBoundary } from '@goodboy/ui';
import type { BranchCommit, SessionId, WorktreeStatus } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  STORY_NOW,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import type { MountGithubState } from '../../../store/types';
import { seedSessionWithMounts } from '../../helpers/seedSessionWithMounts';
import { App } from '../../../App';

const COMMITS: ReadonlyArray<BranchCommit> = [
  {
    sha: 'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1',
    shortSha: 'b2c3d4e',
    subject: 'Keep trailing-comma rows in the ledger-core importer',
    author: 'Robin Vale',
    timestamp: 1_787_900_000,
    pushed: false,
    parentSha: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0',
  },
  {
    sha: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0',
    shortSha: 'a1b2c3d',
    subject: 'Add a failing importer fixture',
    author: 'Robin Vale',
    timestamp: 1_787_890_000,
    pushed: false,
    parentSha: null,
  },
];

const STATUS: WorktreeStatus = {
  branch: null,
  head: COMMITS[0]?.sha ?? null,
  headSubject: COMMITS[0]?.subject ?? null,
  upstreamDistance: { kind: 'unknown', reason: 'no-upstream' },
  mainDistance: { kind: 'known', ahead: 2, behind: 0 },
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  upstream: null,
  inProgress: null,
};

const BRIDGE: Readonly<Record<string, unknown>> = {
  worktree_commits: COMMITS,
  worktree_diff: '',
  worktree_changed_files: {
    paths: ['src/importer.ts'],
    additions: 12,
    deletions: 3,
    numstat: '12\t3\tsrc/importer.ts',
  },
  history_backups_list: [],
  history_graph: {
    baseRef: 'origin/main',
    mergeBase: {
      sha: 'f0e1d2c3b4a5f6e7d8c9b0a1f2e3d4c5b6a7f8e9',
      subject: 'Release 2.14',
      author: 'Robin Vale',
      timestamp: 1_787_880_000,
    },
    mainHead: 'f0e1d2c3b4a5f6e7d8c9b0a1f2e3d4c5b6a7f8e9',
    mainCommits: [],
    behind: 0,
    remoteSha: null,
    files: [],
  },
};

const SELECTS: ReadonlyArray<readonly [RegExp, unknown]> = [[/FROM history_plans /, []]];

const answerSelect = (sql: string): Promise<unknown> => {
  const known = SELECTS.find(([pattern]) => pattern.test(sql));
  return known === undefined ? new Promise<never>(() => undefined) : Promise.resolve(known[1]);
};

export type BridgeArgs = {
  readonly sql?: string;
  readonly worktreePath?: string;
};

const branchAt = (worktreePath: string | undefined): string | null =>
  Object.values(useAppStore.getState().sessionProjectMounts)
    .flat()
    .find((mount) => mount.worktreePath === worktreePath)?.branch ?? null;

export const bridge = (command: string, args?: BridgeArgs): Promise<unknown> => {
  if (command === 'db_select') {
    return answerSelect(args?.sql ?? '');
  }
  if (command === 'db_execute') {
    return Promise.resolve({ rowsAffected: 1 });
  }
  if (command === 'worktree_status') {
    return Promise.resolve({ ...STATUS, branch: branchAt(args?.worktreePath) });
  }
  return command in BRIDGE ? Promise.resolve(BRIDGE[command]) : new Promise<never>(() => undefined);
};

const LOOP_MARKERS = ['Maximum update depth', '#185', 'getSnapshot should be cached'];

type Seed = 'pr' | 'issue';

export type Ctx = {
  readonly sessionId: SessionId;
};

export type Row = {
  readonly name: string;
  readonly covers: ReadonlyArray<string>;
  readonly seed?: Seed;
  readonly open: (ctx: Ctx) => Promise<void>;
  readonly lands: (ctx: Ctx) => Promise<void>;
};

export const SRC = join(__dirname, '..', '..', '..');

export const namesIn = ({
  source,
  pattern,
}: {
  readonly source: string;
  readonly pattern: RegExp;
}) => Array.from(source.matchAll(pattern), (match) => match[1] ?? '').filter((name) => name !== '');

const sliceIndexSources = (): string =>
  readdirSync(join(SRC, 'store', 'slices'))
    .map((name) => join(SRC, 'store', 'slices', name, 'index.ts'))
    .filter((path) => existsSync(path))
    .map((path) => readFileSync(path, 'utf8'))
    .join('\n');

export const STORE_ACTIONS = Array.from(
  new Set(
    namesIn({
      source: sliceIndexSources(),
      pattern:
        /^\s+(open[A-Z]\w*|setActiveLens|navigate|goToHistory|back|forward|up|toggleContextDrawer)\s*:/gm,
    }),
  ),
).sort();

export let useAppStore: StoryStore;

export let consoleErrors: Array<string> = [];

export let calls: Set<string> = new Set();

export const settle = async (rounds = 4): Promise<void> => {
  for (let round = 0; round < rounds; round += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 25));
    });
  }
};

const traceActions = (): void => {
  const state = useAppStore.getState() as unknown as Record<string, unknown>;
  const traced = Object.fromEntries(
    STORE_ACTIONS.flatMap((name) => {
      const original = state[name];
      if (typeof original !== 'function') {
        return [];
      }
      const wrapped = (...args: ReadonlyArray<unknown>) => {
        calls.add(name);
        return (original as (...inner: ReadonlyArray<unknown>) => unknown)(...args);
      };
      return [[name, wrapped]];
    }),
  );
  useAppStore.setState(traced);
};

export const boot = async ({ seed }: { readonly seed: Seed }): Promise<Ctx> => {
  const sessionId = seedSessionWithMounts({ useAppStore, hasPr: seed === 'pr' });
  const seeded = useAppStore.getState();
  const mount = seeded.sessionProjectMounts[sessionId]?.[0] ?? null;
  const github = seeded.sessionGithub[sessionId] ?? null;
  if (seed === 'pr' && (mount === null || github === null || github.pr === null)) {
    throw new Error('the board seed has no mount carrying a pull request');
  }
  const mountGithub: MountGithubState | null =
    mount === null || github === null || github.pr === null
      ? null
      : {
          ...github,
          mountId: mount.mountId,
          projectId: mount.projectId,
          revision: mount.revision,
          repository: `cascade/${mount.mountName}`,
          host: 'github.com',
          branch: mount.branch,
          prs: [github.pr],
          links: [],
        };
  const mounts = seeded.sessionProjectMounts[sessionId] ?? [];
  useAppStore.setState({
    sessionWorktreeRecords: {
      ...seeded.sessionWorktreeRecords,
      [sessionId]: mounts.map((candidate, index) => ({
        id: `navigation-worktree-${index}`,
        sessionId,
        worktreePath: candidate.worktreePath,
        branch: candidate.branch,
        parallelIndex: index,
        projectId: candidate.projectId,
        mountName: candidate.mountName,
        repoSlug: `cascade/${candidate.mountName}`,
        createdAt: Date.parse(STORY_NOW),
      })),
    },
    ...(mountGithub !== null && {
      mountGithub: { ...seeded.mountGithub, [mountGithub.mountId]: mountGithub },
    }),
    hydrate: async () => undefined,
    checkForUpdates: async () => undefined,
    hydrated: true,
    bootPhase: 'ready',
  });
  traceActions();
  render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
  await settle(6);
  calls = new Set();
  return { sessionId };
};

export const click = async (element: HTMLElement): Promise<void> => {
  fireEvent.click(element);
  await settle();
};

export const clickButton = async (name: RegExp | string): Promise<void> => {
  await click(await screen.findByRole('button', { name }));
};

export const clickFirstButton = async (name: RegExp): Promise<void> => {
  const [first] = await screen.findAllByRole('button', { name });
  await click(first!);
};

export const openCrumb = async (label: RegExp): Promise<void> => {
  await clickButton(/^Overview/);
  await click(await screen.findByRole('menuitemradio', { name: label }));
};

export const openPalette = async (label: RegExp, query?: string): Promise<void> => {
  await clickButton(/^Search .+ \(/);
  if (query !== undefined) {
    const input = await screen.findByRole('combobox', { name: /search/i });
    fireEvent.change(input, { target: { value: query } });
    await settle();
  }
  const option = await screen.findByRole('option', { name: label });
  fireEvent.mouseDown(option);
  await settle();
};

export const WAIT = { timeout: 5_000 };

export const visible = async (role: string, name: RegExp | string): Promise<void> => {
  expect(await screen.findByRole(role, { name }, WAIT)).toBeDefined();
};

export const heading = (name: RegExp | string): Promise<void> => visible('heading', name);

export const band = async (title: string): Promise<void> => {
  await waitFor(
    () =>
      expect(document.querySelector(`[data-studio-band][aria-label="${title}"]`)).not.toBeNull(),
    WAIT,
  );
};

export const lens = (lensName: string | null) => async (ctx: Ctx) => {
  await waitFor(
    () => expect(useAppStore.getState().activeLens[ctx.sessionId] ?? null).toBe(lensName),
    WAIT,
  );
};

export const both =
  (...checks: ReadonlyArray<(ctx: Ctx) => Promise<void>>) =>
  async (ctx: Ctx) => {
    for (const check of checks) {
      await check(ctx);
    }
  };

const FOREIGN_CONTROLS: Readonly<Record<string, ReadonlyArray<RegExp>>> = {
  pr: [/^Conversations/, /^Draft fixes/, /^Rebase on /, /^Rewrite history/, /^Fix$/, /^Push \d+$/],
  files: [/^Squash and merge/, /^Mark ready/, /^Conversations/, /^Draft fixes/, /^Write review/],
  review: [/^Squash and merge/, /^Mark ready/, /^Rebase on /, /^Rewrite history/],
};

const expectOwnControlsOnly = ({ sessionId }: Ctx): void => {
  const layer = useAppStore.getState().activeLens[sessionId] ?? null;
  const foreign = layer === null ? [] : (FOREIGN_CONTROLS[layer] ?? []);
  const header = document.querySelector('[data-slot="pane-header"]');
  if (header === null || foreign.length === 0) {
    return;
  }
  const names = within(header as HTMLElement)
    .queryAllByRole('button')
    .map((button) => button.getAttribute('aria-label') ?? button.textContent ?? '');
  expect(names.filter((name) => foreign.some((pattern) => pattern.test(name)))).toEqual([]);
};

export const LENS_ROWS: ReadonlyArray<{
  readonly label: string;
  readonly note?: string;
  readonly lens: string | null;
  readonly seed?: Seed;
  readonly lands: (ctx: Ctx) => Promise<void>;
}> = [
  {
    label: 'Overview',
    lens: null,
    lands: async () => expect(await screen.findByTestId('context-chip')).toBeDefined(),
  },
  { label: 'Workflows', lens: 'workflows', lands: () => heading('Workflows') },
  { label: 'Agents', lens: 'agents', lands: () => heading('Agents') },
  { label: 'Questions', lens: 'questions', lands: () => heading('Questions') },
  { label: 'Artifacts', lens: 'plans', lands: () => heading('Artifacts') },
  { label: 'Review', lens: 'review', lands: () => heading('Review') },
  { label: 'Diff', lens: 'files', lands: () => heading('Diff') },
  {
    label: 'Pull request',
    lens: 'pr',
    lands: () => heading(/Stop retried webhooks/),
  },
  {
    label: 'Pull request',
    note: 'no pull request yet',
    lens: 'pr',
    seed: 'issue',
    lands: () => heading(/^(Code host work|GitHub|GitLab|Bitbucket)$/),
  },
  { label: 'Explore', lens: 'explore', lands: () => heading('Explore') },
  { label: 'Scripts', lens: 'scripts', lands: () => heading('Scripts') },
  { label: 'Terminal', lens: 'terminal', lands: () => heading('Terminal') },
];

const expectNoCrash = (): void => {
  expect(
    consoleErrors.filter((line) => LOOP_MARKERS.some((marker) => line.includes(marker))),
  ).toEqual([]);
  expect(screen.queryByText('Something went wrong')).toBeNull();
};

export const installNavigationHooks = (): void => {
  beforeAll(async () => {
    useAppStore = await importStore();
    await Promise.all([
      import('../../../features/settings/components/SettingsStudio'),
      import('../../../features/settings/components/GuideStudio'),
      import('../../../features/workspace/components/WorkspaceLinkStudio'),
      import('../../../features/workflows/components/WorkflowStudio'),
      import('../../../features/inbox/components/InboxStudio'),
      import('../../../features/impact/components/ImpactStudio'),
      import('../../../features/changelog/components/ChangelogStudio'),
      import('../../../features/notifications/components/NotificationsStudio'),
      import('../../../features/companion/components/CompanionStudio'),
      import('../../../features/workspace-chat/components/ChatStudio'),
    ]);
  }, STORE_IMPORT_TIMEOUT_MS);
  beforeEach(async () => {
    await resetStoryStore();
    consoleErrors = [];
    calls = new Set();
    vi.spyOn(console, 'error').mockImplementation((...args: ReadonlyArray<unknown>) => {
      consoleErrors.push(args.map(String).join(' '));
    });
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });
};

type RunParams = {
  readonly rows: ReadonlyArray<Row>;
};

export const runNavigationRows = ({ rows }: RunParams): void => {
  describe('navigation entries render their destination on the real store', () => {
    it.each(rows.map((row) => [row.name, row] as const))(
      '%s',
      async (_name, row) => {
        const ctx = await boot({ seed: row.seed ?? 'pr' });

        await row.open(ctx);
        await row.lands(ctx);
        expectOwnControlsOnly(ctx);

        const tracedActions = row.covers.filter((token) => STORE_ACTIONS.includes(token));
        expect(tracedActions.filter((name) => !calls.has(name))).toEqual([]);
        expectNoCrash();
      },
      30_000,
    );
  });
};
