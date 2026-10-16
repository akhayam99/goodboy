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
  ReportArtifact,
  SessionId,
} from '@goodboy/types';
import { aSession, anAgent } from '@goodboy/types/testing';
import { useAppStore } from '../../store';
import type { TerminalTabId } from '../../shared/types/terminal';
import type { DrawerRequest } from '../../store/slices/drawer/state';
import { ToastProvider } from '../../shared/components/Toast';
import { CTX_SESSION_ID } from './MockScene/scenes/brand/contextBase';
import { SESSION_ID as RESOLVE_SESSION_ID } from './MockScene/scenes/resolveSeed';
import { seedBulkScene } from './MockScene/scenes/bulkSeed';
import { PLAN_FIXTURE_ID, PLAN_FIXTURE_SESSION } from '../../test/planFixtures';
import { seedPlanDrawer } from '../../test/planDrawerFixtures';
import { brandedId } from '../../features/history/testing/brandedId';
import { DrawerHost } from './DrawerHost';

const MOUNT_ID: MountId = JSON.parse(JSON.stringify('mount-1'));
const SESSION = 'session-harborline' as SessionId;
const REPORT = 'artifact-report' as ArtifactId;
const AGENT = 'agent-resolver' as AgentId;
const TERMINAL = brandedId<TerminalTabId>({ value: `${SESSION}::t1` });
const AT = '2026-10-05T10:00:00.000Z' as IsoDateTime;

const REPORT_ARTIFACT: ReportArtifact = {
  id: REPORT,
  sessionId: SESSION,
  agentId: 'agent-scout' as AgentId,
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
    kind: 'new',
    region: 'New',
    seed: seedSession,
    drawer: { kind: 'new', sessionId: SESSION, payload: null },
  },
  {
    kind: 'context',
    region: 'Context',
    seed: seedSession,
    drawer: {
      kind: 'context',
      sessionId: SESSION,
      payload: { tab: 'goal', view: 'current' },
    },
  },
  {
    kind: 'transcript',
    region: 'Resolve retries',
    seed: seedSession,
    drawer: { kind: 'transcript', sessionId: SESSION, payload: { agentId: AGENT } },
  },
  {
    kind: 'auto-child',
    region: 'Agent',
    seed: seedSession,
    drawer: { kind: 'auto-child', sessionId: SESSION, payload: { agentId: AGENT } },
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
    region: 'payments-api',
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
    (_label, entry) => {
      entry.seed?.();
      useAppStore.setState({ drawer: entry.drawer });

      renderHost();

      const region = screen.getByRole('region', { name: entry.region });
      expect(within(region).getByRole('button', { name: 'Close' })).toBeDefined();
      const namedCloses = within(region)
        .queryAllByRole('button', { name: /^Close .+/ })
        .filter((button) => button.closest('[data-terminal-tab]') === null);
      expect(namedCloses).toHaveLength(0);
    },
  );

  it('covers every drawer kind the host can open', () => {
    const hosted = Array.from(
      readFileSync(join(__dirname, 'DrawerHost.tsx'), 'utf8').matchAll(
        /case '([\w-]+)':(?!\s*return null;)/g,
      ),
      (match) => match[1],
    );
    const covered = new Set(ENTRIES.map((entry) => entry.kind));

    expect(hosted.length).toBeGreaterThan(0);
    expect(hosted.filter((kind) => !covered.has(kind as DrawerRequest['kind']))).toEqual([]);
  });
});

describe('the Context drawer in its versions view', () => {
  it('says Back to current where the others say Close', () => {
    seedSession();
    useAppStore.setState({
      drawer: {
        kind: 'context',
        sessionId: SESSION,
        payload: { tab: 'goal', view: 'versions' },
      },
    });

    renderHost();

    const region = screen.getByRole('region', { name: 'Context' });
    expect(within(region).getByRole('button', { name: 'Back to current' })).toBeDefined();
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
    expect(within(header).getByRole('heading', { name: 'Ask' })).toBeDefined();
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
      expect(screen.getByText(/Couldn't open README.md/)).toBeDefined();
    });

    act(() => {
      useAppStore.setState({ currentSessionId: OTHER, drawer: exploreDrawer(OTHER) });
    });

    expect(screen.queryByText(/Couldn't open README.md/)).toBeNull();
  });
});
