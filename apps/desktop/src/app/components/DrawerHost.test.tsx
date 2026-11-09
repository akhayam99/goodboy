// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('../../features/reports/components/ReportStudio', () => ({
  ReportStudio: ({ artifact }: { artifact: { title: string } }) => <p>Report {artifact.title}</p>,
}));
vi.mock('../../features/wireframes/components/WireframeViewer', () => ({
  WireframeViewer: ({ artifact }: { artifact: { title: string } }) => (
    <p>Wireframe {artifact.title}</p>
  ),
}));
vi.mock('../../shared/components/GenericTerminalPanel/LazyGenericTerminalPanel', () => ({
  LazyGenericTerminalPanel: () => <div data-testid="drawer-terminal" />,
}));
vi.mock('../../features/chat/components/ChatView', () => ({
  ChatView: () => <div data-testid="drawer-transcript" />,
}));

import { brandId } from '@goodboy/types';
import { readFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import type {
  AgentId,
  ArtifactId,
  IsoDateTime,
  MountId,
  OpenQuestionId,
  ReportArtifact,
  SessionId,
} from '@goodboy/types';
import { aSession, anAgent } from '@goodboy/types/testing';
import { useAppStore } from '../../store';
import type { TerminalTabId } from '../../shared/types/terminal';
import type { DrawerRequest } from '../../store/slices/drawer/state';
import { ToastProvider } from '../../shared/components/Toast';
import { CTX_SESSION_ID } from './MockScene/scenes/brand/contextBase';
import { BranchPage } from '../../features/branch/components/BranchPage';
import {
  EXPANDED_THREAD_ID,
  SESSION as RESOLVE_SESSION,
  seedResolveScene,
} from './MockScene/scenes/resolveSeed';
import { SESSION_ID as RESOLVE_SESSION_ID } from './MockScene/scenes/resolveSeed';
import { seedBulkScene } from './MockScene/scenes/bulkSeed';
import { PLAN_FIXTURE_ID, PLAN_FIXTURE_SESSION } from '../../test/planFixtures';
import { seedPlanDrawer } from '../../test/planDrawerFixtures';
import { brandedId } from '../../features/history/testing/brandedId';
import { DrawerHost } from './DrawerHost';

const MOUNT_ID: MountId = JSON.parse(JSON.stringify('mount-1'));
const SESSION = brandId<SessionId>({ value: 'session-harborline' });
const REPORT = brandId<ArtifactId>({ value: 'artifact-report' });
const AGENT = brandId<AgentId>({ value: 'agent-resolver' });
const TERMINAL = brandedId<TerminalTabId>({ value: `${SESSION}::t1` });
const QUESTION = brandedId<OpenQuestionId>({ value: 'question-retry-queue' });
const AT = brandId<IsoDateTime>({ value: '2026-10-05T10:00:00.000Z' });

const REPORT_ARTIFACT: ReportArtifact = {
  id: REPORT,
  sessionId: SESSION,
  agentId: brandId<AgentId>({ value: 'agent-scout' }),
  workflowRunId: null,
  schemaVersion: 1,
  title: 'Rounding drift in ledger-core',
  sourceText: '',
  status: 'active',
  revision: 2,
  sourceTurnId: null,
  createdAt: AT,
  updatedAt: AT,
  openedAt: null,
  kind: 'report',
  sourceFormat: 'markdown',
  metadata: { reportType: 'session-summary' },
};

type Entry = {
  readonly kind: DrawerRequest['kind'];
  readonly region: string;
  readonly seed?: () => void;
  readonly drawer: DrawerRequest;
};

const seedSession = (): void => {
  useAppStore.setState({
    sessions: [aSession({ id: SESSION, goal: 'Fix webhook retries' })],
    currentSessionId: SESSION,
    sessionArtifacts: { [SESSION]: [REPORT_ARTIFACT] },
    sessionPhaseRuns: {
      [SESSION]: [anAgent({ id: AGENT, sessionId: SESSION, name: 'Resolve retries' })],
    },
  });
};

const ENTRIES: ReadonlyArray<Entry> = [
  {
    kind: 'check-analysis',
    region: 'Debugger',
    seed: seedSession,
    drawer: {
      kind: 'check-analysis',
      sessionId: SESSION,
      payload: {
        sessionId: SESSION,
        mountId: MOUNT_ID,
        checkUrl: 'https://github.com/harborline/payments-api/actions/runs/31/job/42',
      },
    },
  },
  {
    kind: 'ask',
    region: 'Ask',
    seed: seedSession,
    drawer: { kind: 'ask', sessionId: SESSION, payload: null },
  },
  {
    kind: 'question',
    region: 'Question',
    seed: () => {
      seedSession();
      useAppStore.setState({
        sessionOpenQuestions: { [SESSION]: [] },
        sessionAnsweredQuestions: { [SESSION]: [] },
      });
    },
    drawer: { kind: 'question', sessionId: SESSION, payload: { questionId: QUESTION } },
  },
  {
    kind: 'new',
    region: 'Write a report',
    seed: seedSession,
    drawer: { kind: 'new', sessionId: SESSION, payload: { form: 'report' } },
  },
  {
    kind: 'context',
    region: 'Context',
    seed: seedSession,
    drawer: {
      kind: 'context',
      sessionId: SESSION,
      payload: { section: 'goal', view: 'current' },
    },
  },
  {
    kind: 'transcript',
    region: 'Transcript',
    seed: seedSession,
    drawer: { kind: 'transcript', sessionId: SESSION, payload: { agentId: AGENT } },
  },
  {
    kind: 'spawned',
    region: 'Agents',
    seed: seedSession,
    drawer: { kind: 'spawned', sessionId: SESSION, payload: null },
  },
  {
    kind: 'session-log',
    region: 'Log',
    seed: seedSession,
    drawer: { kind: 'session-log', sessionId: SESSION, payload: { focusEntryId: null } },
  },
  {
    kind: 'explore-file',
    region: 'README.md',
    seed: seedSession,
    drawer: {
      kind: 'explore-file',
      sessionId: SESSION,
      payload: {
        sessionDir: '/work/ledger-core',
        entry: {
          name: 'README.md',
          relPath: 'README.md',
          isDir: false,
          sizeBytes: 120,
          modifiedAt: null,
        },
      },
    },
  },
  {
    kind: 'scriptRun',
    region: 'Script',
    seed: seedSession,
    drawer: {
      kind: 'scriptRun',
      sessionId: SESSION,
      payload: { scriptKey: 'package:test', mountId: null },
    },
  },
  {
    kind: 'explore',
    region: 'Explore',
    seed: seedSession,
    drawer: { kind: 'explore', sessionId: SESSION, payload: null },
  },
  {
    kind: 'scripts',
    region: 'Scripts',
    seed: seedSession,
    drawer: { kind: 'scripts', sessionId: SESSION, payload: null },
  },
  {
    kind: 'file-diff',
    region: 'Commit a1b2c3d',
    seed: seedSession,
    drawer: {
      kind: 'file-diff',
      sessionId: SESSION,
      payload: {
        source: { kind: 'commit', repo: 'cascade/ledger-core', sha: 'a1b2c3d4e5f6' },
        path: null,
      },
    },
  },
  {
    kind: 'file-diff',
    region: 'importer.ts',
    seed: seedSession,
    drawer: {
      kind: 'file-diff',
      sessionId: SESSION,
      payload: {
        source: { kind: 'worktree', worktreePath: '/mock/ledger-core' },
        path: 'src/importer.ts',
        whole: {
          file: {
            path: 'src/importer.ts',
            status: 'modified',
            additions: 1,
            deletions: 0,
            binary: false,
            hunks: [],
          },
          oldRev: null,
          newRev: null,
          baseBranch: null,
        },
      },
    },
  },
  {
    kind: 'identifier-peek',
    region: 'creditKey',
    seed: seedSession,
    drawer: {
      kind: 'identifier-peek',
      sessionId: SESSION,
      payload: {
        worktreePath: '/mock/ledger-core',
        word: 'creditKey',
        selected: { path: 'src/ledger-core.ts', line: 31 },
      },
    },
  },
  {
    kind: 'artifact-document',
    region: 'Rounding drift in ledger-core',
    seed: seedSession,
    drawer: {
      kind: 'artifact-document',
      sessionId: SESSION,
      payload: { artifactId: REPORT, revision: null },
    },
  },
  {
    kind: 'artifact',
    region: 'Rounding drift in ledger-core',
    seed: seedSession,
    drawer: {
      kind: 'artifact',
      sessionId: SESSION,
      payload: { artifactId: REPORT, tab: 'details' },
    },
  },
  {
    kind: 'artifact-document',
    region: 'Retry-safe webhook credits',
    seed: () => {
      seedPlanDrawer({ parts: 2 });
    },
    drawer: {
      kind: 'artifact-document',
      sessionId: PLAN_FIXTURE_SESSION,
      payload: { artifactId: PLAN_FIXTURE_ID, revision: null },
    },
  },
  {
    kind: 'history-versions',
    region: 'Previous versions',
    seed: seedSession,
    drawer: {
      kind: 'history-versions',
      sessionId: SESSION,
      payload: { mountId: MOUNT_ID, worktreePath: '/w/payments-api' },
    },
  },
  {
    kind: 'fix-comments',
    region: 'Fix comments',
    seed: () => {
      seedBulkScene({ stage: 'launch' });
    },
    drawer: {
      kind: 'fix-comments',
      sessionId: RESOLVE_SESSION_ID,
      payload: { mountId: null },
    },
  },
  {
    kind: 'terminal',
    region: 'Terminal',
    seed: () => {
      seedSession();
      useAppStore.setState({
        terminalTabs: {
          [SESSION]: [
            {
              id: TERMINAL,
              owner: { kind: 'session', sessionId: SESSION },
              title: 'payments-api',
              cwd: '/mock/payments-api',
              status: 'running',
              createdAt: 0,
            },
          ],
        },
      });
    },
    drawer: { kind: 'terminal', sessionId: SESSION, payload: { terminalId: TERMINAL } },
  },
  {
    kind: 'browser',
    region: 'Browser',
    seed: seedSession,
    drawer: { kind: 'browser', sessionId: SESSION, payload: null },
  },
  {
    kind: 'plan-part',
    region: 'Part 1 of 2',
    seed: () => {
      seedPlanDrawer({ parts: 2 });
    },
    drawer: {
      kind: 'plan-part',
      sessionId: PLAN_FIXTURE_SESSION,
      payload: { planId: PLAN_FIXTURE_ID, index: 0 },
    },
  },
];

const PAGE_OWNED_KINDS: ReadonlyArray<DrawerRequest['kind']> = ['conversation'];
const OWN_TEST_KINDS: ReadonlyArray<DrawerRequest['kind']> = ['browser'];

const renderHost = () =>
  render(
    <ToastProvider>
      <DrawerHost />
    </ToastProvider>,
  );

beforeEach(() => {
  useAppStore.setState({ drawer: null });
});

afterEach(() => {
  cleanup();
  useAppStore.setState({ drawer: null });
});

describe('every drawer names its close control Close', () => {
  it.each(ENTRIES.map((entry) => [`${entry.kind}: ${entry.region}`, entry] as const))(
    '%s',
    async (_label, entry) => {
      entry.seed?.();
      useAppStore.setState({ drawer: entry.drawer });

      renderHost();

      const region = await screen.findByRole('region', { name: entry.region });
      within(region).getByRole('button', { name: 'Close' });
      const namedCloses = within(region)
        .queryAllByRole('button', { name: /^Close .+/ })
        .filter((button) => button.closest('[data-terminal-tab]') === null);
      expect(namedCloses).toHaveLength(0);
    },
  );

  it('browser: closes through the address row, named for what it closes', async () => {
    seedSession();
    useAppStore.setState({ drawer: { kind: 'browser', sessionId: SESSION, payload: null } });

    renderHost();

    await screen.findByRole('region', { name: 'Browser' });
    fireEvent.click(await screen.findByRole('button', { name: 'Close browser' }));

    expect(useAppStore.getState().drawer).toBeNull();
  });

  it('covers every drawer kind the host can open', () => {
    const hosted = Array.from(
      readFileSync(join(__dirname, 'DrawerHost.tsx'), 'utf8').matchAll(
        /case '([\w-]+)':(?!\s*return null;)/g,
      ),
      (match) => match[1],
    );
    const covered: ReadonlySet<string> = new Set([
      ...ENTRIES.map((entry) => entry.kind),
      ...PAGE_OWNED_KINDS,
      ...OWN_TEST_KINDS,
    ]);

    expect(hosted.length).toBeGreaterThan(0);
    expect(hosted.filter((kind) => kind === undefined || !covered.has(kind))).toEqual([]);
  });
});

describe('the comment drawer the Comments page portals into the host', () => {
  it('names its close control Close and closes back to the list', async () => {
    seedResolveScene({ expandedThreadId: EXPANDED_THREAD_ID });
    render(
      <ToastProvider>
        <BranchPage session={RESOLVE_SESSION} workingDir={null} />
        <DrawerHost />
      </ToastProvider>,
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    const region = screen.getByRole('region', { name: /retryPolicy\.ts:42/ });
    expect(region.closest('[data-slot="review-comment-drawer"]')).not.toBeNull();
    const close = within(region).getByRole('button', { name: 'Close' });
    expect(within(region).queryAllByRole('button', { name: /^Close .+/ })).toHaveLength(0);

    fireEvent.click(close);

    expect(useAppStore.getState().drawer).toBeNull();
  });
});

describe('the Context drawer in its versions view', () => {
  it('says Back to current where the others say Close', () => {
    seedSession();
    useAppStore.setState({
      drawer: {
        kind: 'context',
        sessionId: SESSION,
        payload: { section: 'goal', view: 'versions' },
      },
    });

    renderHost();

    const region = screen.getByRole('region', { name: 'Context' });
    within(region).getByRole('button', { name: 'Back to current' });
    expect(within(region).queryByRole('button', { name: 'Close' })).toBeNull();
  });
});

describe('the Ask drawer header', () => {
  it('reads Ask, with no session title beside it', () => {
    seedSession();
    useAppStore.setState({ drawer: { kind: 'ask', sessionId: SESSION, payload: null } });

    renderHost();

    const header = within(screen.getByRole('region', { name: 'Ask' })).getByRole('banner');
    expect(header.textContent).not.toContain('Fix webhook retries');
    within(header).getByRole('heading', { name: 'Ask' });
  });
});

describe('the explore file drawer across sessions', () => {
  const OTHER = CTX_SESSION_ID;

  const exploreDrawer = (sessionId: SessionId): DrawerRequest => ({
    kind: 'explore-file',
    sessionId,
    payload: {
      sessionDir: '/work/ledger-core',
      entry: {
        name: 'README.md',
        relPath: 'README.md',
        isDir: false,
        sizeBytes: 120,
        modifiedAt: null,
      },
    },
  });

  it('drops the open failure when another session shows the same path', async () => {
    seedSession();
    vi.mocked(invoke).mockImplementation(async (command: string) => {
      if (command === 'explore_open') {
        throw new Error('no app');
      }
      return new Promise<never>(() => undefined);
    });
    useAppStore.setState({ drawer: exploreDrawer(SESSION) });
    renderHost();

    fireEvent.click(screen.getByRole('button', { name: /^Open/ }));
    await waitFor(() => {
      screen.getByText(/Couldn't open README.md/);
    });

    act(() => {
      useAppStore.setState({ currentSessionId: OTHER, drawer: exploreDrawer(OTHER) });
    });

    expect(screen.queryByText(/Couldn't open README.md/)).toBeNull();
  });
});
