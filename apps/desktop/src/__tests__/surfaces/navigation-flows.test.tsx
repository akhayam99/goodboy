// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((command: string, args?: BridgeArgs) => bridge(command, args)),
}));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => undefined),
  emit: vi.fn(async () => undefined),
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

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
} from '../../store/storyHarness';
import type { MountGithubState } from '../../store/types';
import { seedSessionWithMounts } from '../helpers/seedSessionWithMounts';
import { App } from '../../App';
import { sessionPlace } from '../../store/slices/navigation/place';
import { APP_SECTIONS } from '../../features/settings/components/SettingsStudio/appSections';
import { currentPlatform } from '../../shared/platform';
import type { AgentId, IsoDateTime, MountId, SearchHit } from '@goodboy/types';

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
};

const SELECTS: ReadonlyArray<readonly [RegExp, unknown]> = [[/FROM history_plans /, []]];

const answerSelect = (sql: string): Promise<unknown> => {
  const known = SELECTS.find(([pattern]) => pattern.test(sql));
  return known === undefined ? new Promise<never>(() => undefined) : Promise.resolve(known[1]);
};

type BridgeArgs = {
  readonly sql?: string;
  readonly worktreePath?: string;
};

const branchAt = (worktreePath: string | undefined): string | null =>
  Object.values(useAppStore.getState().sessionProjectMounts)
    .flat()
    .find((mount) => mount.worktreePath === worktreePath)?.branch ?? null;

const bridge = (command: string, args?: BridgeArgs): Promise<unknown> => {
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

type Ctx = {
  readonly sessionId: SessionId;
};

type Row = {
  readonly name: string;
  readonly covers: ReadonlyArray<string>;
  readonly seed?: Seed;
  readonly open: (ctx: Ctx) => Promise<void>;
  readonly lands: (ctx: Ctx) => Promise<void>;
};

const SRC = join(__dirname, '..', '..');

const readSource = (path: string): string => readFileSync(join(SRC, path), 'utf8');

const namesIn = ({ source, pattern }: { readonly source: string; readonly pattern: RegExp }) =>
  Array.from(source.matchAll(pattern), (match) => match[1] ?? '').filter((name) => name !== '');

const sliceIndexSources = (): string =>
  readdirSync(join(SRC, 'store', 'slices'))
    .map((name) => join(SRC, 'store', 'slices', name, 'index.ts'))
    .filter((path) => existsSync(path))
    .map((path) => readFileSync(path, 'utf8'))
    .join('\n');

const STORE_ACTIONS = Array.from(
  new Set(
    namesIn({
      source: sliceIndexSources(),
      pattern:
        /^\s+(open[A-Z]\w*|setActiveLens|navigate|goToHistory|back|forward|up|toggleContextDrawer)\s*:/gm,
    }),
  ),
).sort();

const OVERLAY_OPENERS = Array.from(
  new Set(
    namesIn({
      source: readSource('app/hooks/useAppOverlays/index.ts'),
      pattern: /^\s+(open[A-Z]\w*)[,:]/gm,
    }),
  ),
).sort();

const STUDIO_KINDS = namesIn({
  source: readSource('store/slices/navigation/studio.ts'),
  pattern: /\{ readonly kind: '(\w+)'/g,
});

const SETTINGS_SCOPES = namesIn({
  source:
    /SettingsStudioScope =([^;]+);/.exec(
      readSource('features/settings/components/SettingsStudio/types.ts'),
    )?.[1] ?? '',
  pattern: /'(\w+)'/g,
});

const EXEMPT: Readonly<Record<string, string>> = {
  openDrawer: 'generic drawer primitive, reached through openContextDrawer',
  openWorkspace: 'focuses or opens another window, not a page in this one',
  openTerminal: 'adds a terminal tab to the dock, not a page',
  setActiveLens: 'internal to the navigation slice, the one door is navigate',
  openPalette: 'opens the palette overlay, every palette destination has its own row',
  openShortcutHelp: 'same page as the shortcuts settings row',
  up: 'leaves an agent overlay for its parent place, which the lens rows cover',
  openArtifactConversation: 'an effect of the artifact studio, no control calls it',
  openDiffLens: 'only resolver thread cards and the resolve publish strip call it',
  openResolveDiff: 'resolve queue control, covered by the resolve flows in main-flows',
  openResolvePublication: 'resolve queue control, covered by the resolve flows in main-flows',
  openStorageArtifact:
    'storage rows list artifacts read from disk, which the bridge mock has none of',
};

let useAppStore: StoryStore;
let consoleErrors: Array<string> = [];
let calls: Set<string> = new Set();
let clipboardWrites: Array<string> = [];

beforeAll(async () => {
  useAppStore = await importStore();
  await Promise.all([
    import('../../features/settings/components/SettingsStudio'),
    import('../../features/settings/components/GuideStudio'),
    import('../../features/workspace/components/WorkspaceLinkStudio'),
    import('../../features/workflows/components/WorkflowStudio'),
    import('../../features/inbox/components/InboxStudio'),
    import('../../features/impact/components/ImpactStudio'),
    import('../../features/changelog/components/ChangelogStudio'),
    import('../../features/notifications/components/NotificationsStudio'),
    import('../../features/companion/components/CompanionStudio'),
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

const settle = async (rounds = 4): Promise<void> => {
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

const boot = async ({ seed }: { readonly seed: Seed }): Promise<Ctx> => {
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

const click = async (element: HTMLElement): Promise<void> => {
  fireEvent.click(element);
  await settle();
};

const clickButton = async (name: RegExp | string): Promise<void> => {
  await click(await screen.findByRole('button', { name }));
};

const clickFirstButton = async (name: RegExp): Promise<void> => {
  const [first] = await screen.findAllByRole('button', { name });
  await click(first!);
};

const openCrumb = async (label: RegExp): Promise<void> => {
  await clickButton(/^Overview/);
  await click(await screen.findByRole('menuitemradio', { name: label }));
};

const openPalette = async (label: RegExp, query?: string): Promise<void> => {
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

const openSettingsRail = async (label: RegExp): Promise<void> => {
  await clickButton(/^Open settings/);
  const rail = await screen.findByRole('navigation', { name: 'Settings scopes' });
  await click(within(rail).getAllByRole('button', { name: label })[0] ?? rail);
};

const WAIT = { timeout: 5_000 };

const visible = async (role: string, name: RegExp | string): Promise<void> => {
  expect(await screen.findByRole(role, { name }, WAIT)).toBeDefined();
};

const heading = (name: RegExp | string): Promise<void> => visible('heading', name);

const band = async (title: string): Promise<void> => {
  await waitFor(
    () =>
      expect(document.querySelector(`[data-studio-band][aria-label="${title}"]`)).not.toBeNull(),
    WAIT,
  );
};

const lens = (lensName: string | null) => async (ctx: Ctx) => {
  await waitFor(
    () => expect(useAppStore.getState().activeLens[ctx.sessionId] ?? null).toBe(lensName),
    WAIT,
  );
};

const both =
  (...checks: ReadonlyArray<(ctx: Ctx) => Promise<void>>) =>
  async (ctx: Ctx) => {
    for (const check of checks) {
      await check(ctx);
    }
  };

const openDiffHistory = async (): Promise<void> => {
  await openCrumb(/^Diff/);
  await clickButton(/Rewrite history/);
};

const LENS_ROWS: ReadonlyArray<{
  readonly label: string;
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
  { label: 'Review', lens: 'review', lands: () => heading('Conversations') },
  { label: 'Diff', lens: 'files', lands: () => heading('Diff') },
  {
    label: 'Pull request',
    lens: 'pr',
    seed: 'issue',
    lands: () => heading(/^(Code host work|GitHub|GitLab|Bitbucket)$/),
  },
  { label: 'Explore', lens: 'explore', lands: () => heading('Explore') },
  { label: 'Scripts', lens: 'scripts', lands: () => heading('Scripts') },
  { label: 'Terminal', lens: 'terminal', lands: () => heading('Terminal') },
];

const pressCommand = async (code: string): Promise<void> => {
  const isMac = currentPlatform() === 'darwin';
  fireEvent.keyDown(window, { code, metaKey: isMac, ctrlKey: !isMac });
  await settle();
};

type SearchHitParams = {
  readonly ctx: Ctx;
  readonly overrides: Partial<SearchHit>;
};

const searchHit = ({ ctx, overrides }: SearchHitParams): SearchHit => ({
  docId: `${overrides.kind ?? 'session'}:hit`,
  kind: 'session',
  refId: 'hit',
  workspaceId: useAppStore.getState().currentWorkspaceId,
  sessionId: ctx.sessionId,
  sessionTitle: 'Stop retried webhooks',
  agentId: null,
  agentName: null,
  mountId: null,
  provider: null,
  container: null,
  status: null,
  ordinal: null,
  url: null,
  isArchived: false,
  occurredAt: STORY_NOW as IsoDateTime,
  title: [{ text: 'Retried webhook ledger', isMatch: false }],
  snippet: [{ text: 'ledger', isMatch: true }],
  ...overrides,
});

type SearchJumpParams = {
  readonly ctx: Ctx;
  readonly overrides: (ctx: Ctx) => Partial<SearchHit>;
};

const searchAndOpen = async ({ ctx, overrides }: SearchJumpParams): Promise<void> => {
  const hit = searchHit({ ctx, overrides: overrides(ctx) });
  useAppStore.setState({ runSearch: async () => [hit] } as never);
  await pressCommand('KeyF');
  const input = await screen.findByRole('combobox', { name: 'Search' });
  fireEvent.change(input, { target: { value: 'ledger' } });
  await settle(8);
  fireEvent.keyDown(input, { key: 'Enter' });
  await settle(6);
};

const firstMountId = (ctx: Ctx): MountId =>
  useAppStore.getState().sessionMounts[ctx.sessionId]?.[0]?.id ?? ('none' as MountId);

const SEARCH_JUMPS: ReadonlyArray<{
  readonly kind: string;
  readonly overrides: (ctx: Ctx) => Partial<SearchHit>;
  readonly lands: (ctx: Ctx) => Promise<void>;
}> = [
  { kind: 'session', overrides: () => ({ kind: 'session' }), lands: lens(null) },
  {
    kind: 'message',
    overrides: () => ({ kind: 'message', agentId: 'agent-gone' as AgentId, status: 'user' }),
    lands: lens('agents'),
  },
  { kind: 'plan', overrides: () => ({ kind: 'plan', refId: 'plan-1' }), lands: lens('plans') },
  {
    kind: 'decision',
    overrides: () => ({ kind: 'decision', ordinal: 1 }),
    lands: async (ctx) => {
      await waitFor(
        () =>
          expect(useAppStore.getState().drawer).toMatchObject({
            kind: 'context',
            sessionId: ctx.sessionId,
            payload: { tab: 'decisions', highlight: [1] },
          }),
        WAIT,
      );
    },
  },
  {
    kind: 'question',
    overrides: () => ({ kind: 'question', refId: 'q-1' }),
    lands: lens('questions'),
  },
  { kind: 'pr', overrides: () => ({ kind: 'pr' }), lands: lens('review') },
  {
    kind: 'comment',
    overrides: () => ({ kind: 'comment', refId: 'c-1' }),
    lands: async (ctx) => {
      await lens('files')(ctx);
      await waitFor(
        () =>
          expect(useAppStore.getState().drawer).toMatchObject({
            kind: 'diff-notes',
            sessionId: ctx.sessionId,
          }),
        WAIT,
      );
    },
  },
  {
    kind: 'workflow',
    overrides: () => {
      const state = useAppStore.getState();
      const workspaceId = state.currentWorkspaceId;
      const first = workspaceId === null ? undefined : state.phaseTemplates[workspaceId]?.[0];
      return { kind: 'workflow', sessionId: null, refId: first?.id ?? 'workflow-none' };
    },
    lands: () => band('Workflows'),
  },
  {
    kind: 'branch',
    overrides: (ctx) => ({ kind: 'branch', mountId: firstMountId(ctx), status: 'attached' }),
    lands: lens('files'),
  },
];

const ROWS: ReadonlyArray<Row> = [
  ...LENS_ROWS.map((row): Row => ({
    name: `crumb menu: ${row.label}`,
    covers: ['navigate', `crumb:${row.label}`, `lens:${row.lens ?? 'overview'}`],
    ...(row.seed !== undefined && { seed: row.seed }),
    open: () => openCrumb(new RegExp(`^${row.label}`)),
    lands: both(lens(row.lens), row.lands),
  })),
  ...LENS_ROWS.map((row): Row => ({
    name: `palette: Open ${row.label}`,
    covers: ['navigate', `palette:Open ${row.label}`],
    ...(row.seed !== undefined && { seed: row.seed }),
    open: () => openPalette(new RegExp(`^Open ${row.label}`)),
    lands: both(lens(row.lens), row.lands),
  })),
  {
    name: 'rewrite history from the diff',
    covers: ['openRewriteHistory'],
    open: openDiffHistory,
    lands: () => heading('Rewrite history'),
  },
  {
    name: 'branch history backups inside rewrite history',
    covers: ['openRewriteHistory'],
    open: async () => {
      await openDiffHistory();
      await clickButton('More history actions');
      await click(await screen.findByRole('menuitem', { name: /Backups/ }));
    },
    lands: () => visible('region', 'Backups'),
  },
  {
    name: 'context drawer from the overview chip',
    covers: ['openContextDrawer', 'drawer:context'],
    open: async () => click(await screen.findByTestId('context-chip')),
    lands: () => visible('region', 'Context'),
  },
  {
    name: 'palette: Show context',
    covers: ['toggleContextDrawer', 'palette:Show context'],
    open: () => openPalette(/^Show context/),
    lands: () => visible('region', 'Context'),
  },
  {
    name: 'palette: Back to board',
    covers: ['navigate', 'palette:Back to board'],
    open: () => openPalette(/^Back to board/),
    lands: () => heading('Board'),
  },
  {
    name: 'palette: Inbox',
    covers: ['openStudio', 'studio:inbox', 'palette:Inbox'],
    open: () => openPalette(/^Inbox$/),
    lands: both(
      () => band('Inbox'),
      () => heading('All items'),
    ),
  },
  {
    name: 'palette: Workflows',
    covers: ['openStudio', 'studio:workflow', 'palette:Workflows'],
    open: () => openPalette(/^Workflows$/),
    lands: both(
      () => band('Workflows'),
      () => visible('button', 'New workflow'),
    ),
  },
  {
    name: 'palette: Impact',
    covers: ['openStudio', 'studio:impact', 'palette:Impact'],
    open: () => openPalette(/^Impact$/),
    lands: () => band('Impact'),
  },
  {
    name: 'palette: Impact: Spend',
    covers: ['openStudio', 'studio:impact', 'palette:Impact: Spend'],
    open: () => openPalette(/^Impact: Spend/),
    lands: both(
      () => band('Impact'),
      () => heading('Spend'),
    ),
  },
  {
    name: 'palette: Changelog',
    covers: ['openStudio', 'studio:changelog', 'palette:Changelog'],
    open: () => openPalette(/^Changelog/),
    lands: both(
      () => band('Changelog'),
      () => heading(/^Goodboy \d/),
    ),
  },
  {
    name: 'palette: Notifications',
    covers: ['openStudio', 'studio:notifications', 'palette:Notifications'],
    open: () => openPalette(/^Notifications/),
    lands: both(
      () => band('Notifications'),
      () => heading('All notifications'),
    ),
  },
  {
    name: 'palette: Workspace settings',
    covers: ['openStudio', 'studio:settings', 'scope:workspace', 'palette:Workspace settings'],
    open: () => openPalette(/^Workspace settings/),
    lands: both(
      () => band('Settings'),
      () => heading('About you'),
    ),
  },
  {
    name: 'palette: Open settings',
    covers: ['openStudio', 'studio:settings', 'scope:app', 'palette:Open settings'],
    open: () => openPalette(/^Open settings/),
    lands: both(
      () => band('Settings'),
      () => heading('Appearance'),
    ),
  },
  {
    name: 'palette: New session',
    covers: ['palette:New session'],
    open: async (ctx) => {
      const seeded = useAppStore.getState().sessions.find((s) => s.id === ctx.sessionId)!;
      useAppStore.setState({
        createSession: async () => {
          const session = {
            ...seeded,
            id: 'session-blank-start' as SessionId,
            goal: '',
            workflowRuns: [],
          };
          useAppStore.setState((state) => ({
            sessions: [session, ...state.sessions],
            sessionPhaseRuns: { ...state.sessionPhaseRuns, [session.id]: [] },
            sessionSlots: { ...state.sessionSlots, [session.id]: [] },
            sessionProjectMounts: { ...state.sessionProjectMounts, [session.id]: [] },
          }));
          useAppStore.getState().navigate({ to: sessionPlace({ sessionId: session.id }) });
          return { session };
        },
      } as never);
      await openPalette(/^New session/);
    },
    lands: both(async (ctx) => {
      await waitFor(() => {
        const state = useAppStore.getState();
        const current = state.sessions.find((candidate) => candidate.id === state.currentSessionId);
        expect(current?.id).not.toBe(ctx.sessionId);
        expect(current?.goal).toBe('');
        expect(state.activeLens[current!.id] ?? null).toBeNull();
      }, WAIT);
    }),
  },
  {
    name: 'palette: Connect a provider',
    covers: ['openStudio', 'scope:providers', 'palette:Connect a provider'],
    open: () => openPalette(/^Connect a provider/),
    lands: both(
      () => band('Settings'),
      () => visible('region', 'Providers'),
    ),
  },
  {
    name: 'palette: Pair your iPhone',
    covers: ['openStudio', 'studio:companion', 'palette:Pair your iPhone'],
    open: () => openPalette(/^Pair your iPhone/),
    lands: () => band('Pair device'),
  },
  {
    name: 'palette: Report a bug',
    covers: ['palette:Report a bug'],
    open: () => openPalette(/^Report a bug/),
    lands: () => visible('dialog', 'Report a bug'),
  },
  {
    name: 'palette: Keyboard shortcuts',
    covers: ['openStudio', 'settings:shortcuts', 'palette:Keyboard shortcuts'],
    open: () => openPalette(/^Keyboard shortcuts/),
    lands: () => heading('Shortcuts'),
  },
  {
    name: 'palette: Guide',
    covers: ['openStudio', 'studio:guide', 'palette:Guide'],
    open: () => openPalette(/^Guide/),
    lands: () => band('Guide'),
  },
  {
    name: 'palette verb: Rename',
    covers: ['palette:Rename'],
    open: () => openPalette(/^Rename$/),
    lands: () => visible('textbox', 'Session title'),
  },
  {
    name: 'palette verb: Start agent',
    covers: ['navigate', 'palette:Start agent'],
    open: () => openPalette(/^Start agent$/),
    lands: both(lens('agents'), () => heading('Agents')),
  },
  {
    name: 'palette verb: Link an issue',
    covers: ['palette:Link an issue'],
    open: () => openPalette(/^Link an issue$/),
    lands: () => visible('dialog', 'Link an issue'),
  },
  ...(['Copy title', 'Copy branch name', 'Copy PR link'] as const).map((label): Row => ({
    name: `palette verb: ${label}`,
    covers: [`palette:${label}`],
    open: async () => {
      clipboardWrites = [];
      vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(async (text: string) => {
        clipboardWrites.push(text);
      });
      await openPalette(new RegExp(`^${label}$`));
    },
    lands: async () => {
      await waitFor(() => expect(clipboardWrites).toHaveLength(1), WAIT);
      expect(clipboardWrites[0]?.trim()).not.toBe('');
    },
  })),
  {
    name: 'palette verb: Archive',
    covers: ['palette:Archive'],
    open: async () => {
      useAppStore.setState({ archiveTask: async () => undefined } as never);
      await openPalette(/^Archive$/);
    },
    lands: async () => expect(await screen.findByText('Session archived', {}, WAIT)).toBeDefined(),
  },
  {
    name: 'palette verb: Delete asks first',
    covers: ['palette:Delete…'],
    open: () => openPalette(/^Delete/),
    lands: async () => expect(await screen.findByText('Delete session?', {}, WAIT)).toBeDefined(),
  },
  {
    name: 'palette: Add workspace',
    covers: ['openStudio', 'studio:addWorkspace', 'openAddWorkspace', 'palette:Add workspace'],
    open: () => openPalette(/^Add workspace/, 'Add workspace'),
    lands: () => band('Add workspace'),
  },
  {
    name: 'footer: inbox',
    covers: ['openInbox', 'studio:inbox'],
    open: () => clickButton(/^Open the inbox/),
    lands: () => heading('All items'),
  },
  {
    name: 'footer: workflow library',
    covers: ['openWorkflows', 'studio:workflow'],
    open: () => clickButton(/^Open the workflow library/),
    lands: () => visible('button', 'New workflow'),
  },
  {
    name: 'footer: impact',
    covers: ['openImpact', 'studio:impact'],
    open: () => clickButton(/^Open Impact/),
    lands: () => band('Impact'),
  },
  {
    name: 'footer: settings',
    covers: ['openSettings', 'studio:settings', 'settings:general'],
    open: () => clickButton(/^Open settings/),
    lands: () => heading('Appearance'),
  },
  {
    name: 'footer: integrations',
    covers: ['openIntegration', 'integrations'],
    open: () => clickButton(/^Link your first integration/),
    lands: () => visible('dialog', 'Integrations'),
  },
  {
    name: 'footer: goodboy chip to the changelog',
    covers: ['openChangelog', 'studio:changelog'],
    open: async () => {
      await clickButton(/^Goodboy: setup/);
      await clickButton(/^What's new/);
    },
    lands: () => heading(/^Goodboy \d/),
  },
  {
    name: 'top bar: spend',
    covers: ['openSpend', 'studio:impact'],
    open: () => clickButton(/^Spent today/),
    lands: () => heading('Spend'),
  },
  {
    name: 'top bar: all notifications',
    covers: ['studio:notifications'],
    open: async () => {
      await clickButton(/^Notifications$/);
      await clickButton(/^Open all notifications/);
    },
    lands: () => heading('All notifications'),
  },
  {
    name: 'workspace switcher: workspace settings',
    covers: ['studio:settings', 'scope:workspace'],
    open: async () => {
      await clickButton(/^Switch workspace/);
      await clickButton(/^Workspace settings/);
    },
    lands: () => heading('About you'),
  },
  ...APP_SECTIONS.map((section): Row => ({
    name: `settings rail: ${section.label}`,
    covers: ['openSettings', `settings:${section.id}`],
    open: () => openSettingsRail(new RegExp(`^${section.label}`)),
    lands: () => heading(section.id === 'general' ? 'Appearance' : section.label),
  })),
  {
    name: 'settings rail: backup export',
    covers: ['openSettings', 'settings:backup'],
    open: () => openSettingsRail(/^Backup/),
    lands: both(
      () => heading('Export'),
      () => heading('Import'),
    ),
  },
  {
    name: 'settings rail: storage worktrees',
    covers: ['openSettings', 'settings:storage'],
    open: () => openSettingsRail(/^Storage/),
    lands: () => visible('region', 'Worktrees'),
  },
  {
    name: 'settings rail: workspace',
    covers: ['openSettings', 'scope:workspace'],
    open: () => openSettingsRail(/^Workspace/),
    lands: () => heading('About you'),
  },
  {
    name: 'settings rail: providers and models',
    covers: ['openSettings', 'openProviders', 'scope:providers'],
    open: () => openSettingsRail(/^Providers & models/),
    lands: () => visible('region', 'Providers'),
  },
  {
    name: 'settings rail: one provider page',
    covers: ['openSettings', 'scope:providers', 'settings:provider'],
    open: async () => {
      await openSettingsRail(/^Providers & models/);
      const rail = await screen.findByRole('list', { name: 'Providers & models settings' });
      await click(within(rail).getByRole('button', { name: /Claude/ }));
    },
    lands: () => heading('Claude'),
  },
  {
    name: 'settings rail: integrations',
    covers: ['openSettings', 'scope:tools'],
    open: () => openSettingsRail(/^Integrations/),
    lands: () => visible('list', 'Integrations settings'),
  },
  {
    name: 'mount row: scripts',
    covers: ['navigate', 'lens:scripts'],
    open: () => clickFirstButton(/^Open scripts for/),
    lands: both(lens('scripts'), () => heading('Scripts')),
  },
  {
    name: 'mount row: terminal',
    covers: ['openMountTerminal', 'lens:terminal'],
    open: () => clickFirstButton(/^Open terminal for/),
    lands: lens('terminal'),
  },
  {
    name: 'linked issue chip',
    covers: ['openExternalTaskLens'],
    seed: 'issue',
    open: () => clickButton(/^Open HBL-377/),
    lands: async () => expect((await screen.findAllByText(/HBL-377/)).length).toBeGreaterThan(0),
  },
  {
    name: 'back arrow returns to the overview',
    covers: ['back'],
    open: async () => {
      await openCrumb(/^Diff/);
      await clickButton(/^Back/);
    },
    lands: lens(null),
  },
  {
    name: 'forward arrow returns to the diff',
    covers: ['back', 'forward'],
    open: async () => {
      await openCrumb(/^Diff/);
      await clickButton(/^Back/);
      await clickButton(/^Forward/);
    },
    lands: both(lens('files'), () => heading('Diff')),
  },
  {
    name: 'pull request page from the mount row',
    covers: ['openMountRequest', 'openReviewTarget'],
    open: () => clickFirstButton(/^Open PR #\d+ of /),
    lands: both(lens('review'), () => heading(/Stop retried webhooks/)),
  },
  {
    name: 'mount row: changes to the mount diff',
    covers: ['openMountDiff'],
    open: () => clickFirstButton(/^View the changes of /),
    lands: both(lens('files'), () => heading('Diff')),
  },
  ...(['Report', 'Wireframe'] as const).map((kind): Row => ({
    name: `overview create menu: ${kind.toLowerCase()}`,
    covers: ['openArtifactCreation'],
    open: async () => {
      await clickButton(/^Create$/);
      await click(await screen.findByRole('menuitem', { name: new RegExp(`^${kind}`) }));
    },
    lands: () => heading(`Create ${kind.toLowerCase()}`),
  })),
  {
    name: 'search: Cmd+F opens search scoped to the session',
    covers: ['search.open'],
    open: () => pressCommand('KeyF'),
    lands: async () => {
      await visible('dialog', 'Search');
      expect(await screen.findByText('In session')).toBeDefined();
    },
  },
  ...SEARCH_JUMPS.map((jump): Row => ({
    name: `search: a ${jump.kind} hit lands in context`,
    covers: [jump.kind === 'workflow' ? 'openStudio' : 'navigate', `search:${jump.kind}`],
    open: (ctx) => searchAndOpen({ ctx, overrides: jump.overrides }),
    lands: jump.lands,
  })),
  {
    name: 'back arrow history menu jumps to an entry',
    covers: ['goToHistory'],
    open: async () => {
      await openCrumb(/^Diff/);
      fireEvent.contextMenu(await screen.findByRole('button', { name: /^Back/ }));
      await settle();
      const entries = await screen.findAllByRole('menuitemradio');
      const target = entries.find((entry) => entry.getAttribute('aria-checked') !== 'true');
      if (target === undefined) {
        throw new Error('the history menu has no other entry');
      }
      await click(target);
    },
    lands: lens(null),
  },
];

const declared = new Set(ROWS.flatMap((row) => row.covers));

const expectNoCrash = (): void => {
  expect(
    consoleErrors.filter((line) => LOOP_MARKERS.some((marker) => line.includes(marker))),
  ).toEqual([]);
  expect(screen.queryByText('Something went wrong')).toBeNull();
};

describe('navigation entries render their destination on the real store', () => {
  it.each(ROWS.map((row) => [row.name, row] as const))(
    '%s',
    async (_name, row) => {
      const ctx = await boot({ seed: row.seed ?? 'pr' });

      await row.open(ctx);
      await row.lands(ctx);

      const tracedActions = row.covers.filter((token) => STORE_ACTIONS.includes(token));
      expect(tracedActions.filter((name) => !calls.has(name))).toEqual([]);
      expectNoCrash();
    },
    30_000,
  );
});

describe('navigation flow table ratchet', () => {
  it('has a row for every navigation action of the store and the app overlays', () => {
    const missing = [...STORE_ACTIONS, ...OVERLAY_OPENERS].filter(
      (name) => !declared.has(name) && EXEMPT[name] === undefined,
    );
    expect(missing).toEqual([]);
    const stale = Object.keys(EXEMPT).filter(
      (name) => ![...STORE_ACTIONS, ...OVERLAY_OPENERS].includes(name) || declared.has(name),
    );
    expect(stale).toEqual([]);
  });

  it('has a row for every studio, settings scope and app settings section', () => {
    expect(STUDIO_KINDS.length).toBeGreaterThan(0);
    expect(SETTINGS_SCOPES.length).toBeGreaterThan(0);
    const missing = [
      ...STUDIO_KINDS.map((kind) => `studio:${kind}`),
      ...SETTINGS_SCOPES.map((scope) => `scope:${scope}`),
      ...APP_SECTIONS.map((section) => `settings:${section.id}`),
    ].filter((token) => !declared.has(token));
    expect(missing).toEqual([]);
  });

  it('has a row for every crumb menu entry and palette destination', async () => {
    await boot({ seed: 'pr' });
    await clickButton(/^Overview/);
    const crumbs = screen.getAllByRole('menuitemradio').map((item) => {
      const text = (item.textContent ?? '').trim();
      const known = LENS_ROWS.find((row) => text.startsWith(row.label));
      return `crumb:${known?.label ?? text}`;
    });
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await settle();
    await clickButton(/^Search .+ \(/);
    const sessionGoals = new Set(useAppStore.getState().sessions.map((session) => session.goal));
    const workspaceNames = new Set(useAppStore.getState().workspaces.map((ws) => ws.name));
    const agentNames = new Set(
      Object.values(useAppStore.getState().sessionPhaseRuns)
        .flat()
        .map((agent) => agent.name),
    );
    const destinations = screen
      .getAllByRole('option')
      .map((option) => option.getAttribute('aria-label') ?? option.textContent ?? '')
      .filter(
        (label) =>
          ![...sessionGoals, ...workspaceNames, ...agentNames].some((name) =>
            label.startsWith(name),
          ) && !/^Switch to (light|dark) mode/.test(label),
      )
      .map((label) => `palette:${label.replace(/(Ctrl|⌘).*$/, '').trim()}`);

    expect(crumbs.length).toBeGreaterThan(0);
    expect(destinations.length).toBeGreaterThan(0);
    expect([...crumbs, ...destinations].filter((token) => !declared.has(token))).toEqual([]);
  }, 30_000);
});
