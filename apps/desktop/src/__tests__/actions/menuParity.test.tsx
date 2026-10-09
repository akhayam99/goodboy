// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((command: string) =>
    Promise.resolve(command === 'db_select' || command.includes('_list') ? [] : null),
  ),
}));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => undefined),
  emit: vi.fn(async () => undefined),
}));

import type { ReactNode } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { GitMerge, XCircle } from 'lucide-react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import { ObjectMenuProvider } from '../../features/actions/components/ObjectMenuProvider';
import { StageBoardCard } from '../../features/workspace/components/StageBoard/StageBoardCard';
import type { BoardNavigation } from '../../features/workspace/components/StageBoard/useBoardNavigation';
import { FileHeader } from '../../features/diff/components/DiffView/FileHeader';
import { ScriptRow } from '../../features/scripts/components/ScriptRow';
import { RecordHeader } from '../../shared/components/StudioDetail/RecordHeader';
import { ArtifactShellHeader } from '../../features/artifacts/components/ArtifactShell/ArtifactShellHeader';
import { ArtifactShellActions } from '../../features/artifacts/components/ArtifactShell/ArtifactShellActions';
import { bindTarget } from '../../features/actions/registry';
import { WorkflowRunDetail } from '../../features/session/components/SessionWorkspace/parts/WorkflowRunDetail';
import { AgentHeaderActions } from '../../features/session/components/AgentHeaderActions';
import type { ArtifactActionTarget, CommitActionTarget } from '../../features/actions/types';
import { HistoryCommitRow } from '../../features/history/components/CommitsHistory/HistoryCommitRow';
import { PaletteOverlay } from '../../features/palette/components/PaletteOverlay';
import { ToastProvider } from '../../shared/components/Toast';
import type { RunnableScript } from '../../features/scripts/buildSessionScripts';
import {
  AGENT,
  FIXTURE_NOW,
  RUN,
  SESSION,
  WORKSPACE,
  agentFixture,
  mountFixture,
  runFixture,
  seedActionState,
  sessionFixture,
  workflowFixture,
} from '../helpers/actionFixtures';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const withMenus = (node: ReactNode) =>
  render(
    <ToastProvider>
      <ObjectMenuProvider>{node}</ObjectMenuProvider>
    </ToastProvider>,
  );

const menuLabels = (): ReadonlyArray<string> =>
  screen
    .getAllByRole('menuitem')
    .map((item) => item.getAttribute('data-menu-label') ?? item.textContent ?? '');

const closeMenus = async (): Promise<void> => {
  await act(async () => {
    fireEvent.mouseDown(document.body);
  });
};

const GOTO_LABELS: ReadonlySet<string> = new Set([
  'Board',
  'Tasks',
  'Chat',
  'Workflows',
  'Impact',
  'Notifications',
  "What's new",
  'New session',
  'Settings',
  'Connect a provider',
  'Pair your iPhone',
  'Report a bug',
  'Keyboard shortcuts',
  'Guide',
]);

const optionLabels = (): ReadonlyArray<string> =>
  screen.getAllByRole('option').map((option) => option.getAttribute('aria-label') ?? '');

const overflowThenContext = async ({
  overflow,
  context,
}: {
  readonly overflow: HTMLElement;
  readonly context: HTMLElement;
}) => {
  fireEvent.click(overflow);
  const fromOverflow = menuLabels();
  await closeMenus();
  fireEvent.contextMenu(context);
  const fromContext = menuLabels();
  return { fromOverflow, fromContext };
};

const NAV: BoardNavigation = {
  selectCard: vi.fn(),
  openAgent: vi.fn(),
  openTerminal: vi.fn(),
  openIDE: vi.fn(),
  openQuestions: vi.fn(),
  openWorkflows: vi.fn(),
  openPullRequest: vi.fn(),
  openReview: vi.fn(),
};

describe('every ⋯ menu and its right click list the same actions in the same order', () => {
  it('board card', async () => {
    seedActionState({
      useAppStore,
      seed: { mounts: [mountFixture()], branch: 'hl/payout-export' },
    });
    const { container } = withMenus(<StageBoardCard session={sessionFixture()} nav={NAV} />);
    const { fromOverflow, fromContext } = await overflowThenContext({
      overflow: screen.getByRole('button', { name: 'Session actions' }),
      context: container.querySelector('article') as HTMLElement,
    });
    expect(fromOverflow.length).toBeGreaterThan(5);
    expect(fromContext).toEqual(fromOverflow);
  });

  it('board card: the ⋯ and the right click offer Pin session, then Unpin session once pinned', async () => {
    seedActionState({
      useAppStore,
      seed: { mounts: [mountFixture()], branch: 'hl/payout-export' },
    });
    const { container } = withMenus(<StageBoardCard session={sessionFixture()} nav={NAV} />);
    const overflow = screen.getByRole('button', { name: 'Session actions' });
    const context = container.querySelector('article') as HTMLElement;

    const before = await overflowThenContext({ overflow, context });
    expect(before.fromOverflow).toContain('Pin session');
    expect(before.fromOverflow).not.toContain('Unpin session');
    expect(before.fromContext).toEqual(before.fromOverflow);
    await closeMenus();

    act(() => useAppStore.setState({ sessionPins: { [WORKSPACE]: [{ id: SESSION, at: 1 }] } }));
    const after = await overflowThenContext({ overflow, context });
    expect(after.fromOverflow).toContain('Unpin session');
    expect(after.fromOverflow).not.toContain('Pin session');
    expect(after.fromContext).toEqual(after.fromOverflow);
  });

  it('diff file header', async () => {
    withMenus(
      <FileHeader
        file={{
          path: 'ledger-core/src/importer.ts',
          status: 'modified',
          additions: 12,
          deletions: 3,
          binary: false,
          hunks: [],
        }}
        collapsed={false}
        onToggleCollapsed={vi.fn()}
        commentCount={0}
        viewed={null}
        onToggleViewed={null}
        onOpenInEditor={vi.fn()}
        onCommentOnFile={vi.fn()}
      />,
    );
    const header = document.querySelector('[data-slot="diff-file-header"]') as HTMLElement;
    const { fromOverflow, fromContext } = await overflowThenContext({
      overflow: screen.getByRole('button', { name: /More actions for/ }),
      context: header,
    });
    expect(fromOverflow).toEqual(['Open in editor', 'Comment on file', 'Copy path']);
    expect(fromContext).toEqual(fromOverflow);
  });

  it('script row', async () => {
    const script = {
      key: 'ledger-core:dev',
      name: 'dev',
      body: 'vite --port 3000',
      invocation: 'pnpm run dev',
      source: 'package.json',
      category: 'dev',
      relDir: '',
      manager: 'pnpm',
      packageName: 'ledger-core',
      savedId: null,
    } as unknown as RunnableScript;
    withMenus(
      <ScriptRow
        script={script}
        record={null}
        now={0}
        isSelected={false}
        showSource
        blockedReason={null}
        isPinned={false}
        onTogglePin={vi.fn()}
        onOpen={vi.fn()}
        onRun={vi.fn()}
        onStop={vi.fn()}
        target={{
          kind: 'script',
          facts: {
            name: 'dev',
            command: 'pnpm run dev',
            isRunning: false,
            runBlockedReason: null,
            onShowOutput: vi.fn(),
            onRun: vi.fn(),
            onStop: vi.fn(),
            onEdit: null,
            onDuplicate: null,
            onSaveAs: vi.fn(),
            onDelete: null,
          },
        }}
      />,
    );
    const { fromOverflow, fromContext } = await overflowThenContext({
      overflow: screen.getByRole('button', { name: 'More for dev' }),
      context: screen.getByRole('button', { name: 'Show dev output' }),
    });
    expect(fromOverflow).toEqual(['Show output', 'Run', 'Save as script', 'Copy command']);
    expect(fromContext).toEqual(fromOverflow);
  });

  it('artifact viewer header: the ⋯ and the right click list every action, buttons included, in registry order', async () => {
    seedActionState({ useAppStore, seed: {} });
    useAppStore.setState({
      sessionPlans: { [SESSION]: [] },
      sessionArtifacts: {
        [SESSION]: [
          {
            id: 'artifact-payout',
            sessionId: SESSION,
            agentId: AGENT,
            workflowRunId: null,
            kind: 'plan',
            schemaVersion: 1,
            title: 'Speed up the payout export',
            sourceFormat: 'markdown',
            sourceText: '# Speed up the payout export',
            metadata: {},
            status: 'active',
            revision: 1,
            createdAt: FIXTURE_NOW,
            updatedAt: FIXTURE_NOW,
          } as never,
        ],
      },
    });
    const target: ArtifactActionTarget = {
      kind: 'artifact',
      sessionId: SESSION,
      subject: { kind: 'stored', artifactId: 'artifact-payout' as never, isPlanRunning: false },
    };
    withMenus(
      <ArtifactShellHeader
        kind="plan"
        title="Speed up the payout export"
        chip={null}
        actions={<ArtifactShellActions target={target} onArm={() => undefined} />}
        toggles={null}
        meta={null}
      />,
    );
    const viewing = { kind: 'artifact', id: 'artifact-payout' } as const;
    const resolved =
      bindTarget({ state: useAppStore.getState(), target })?.resolve({ viewing }) ?? [];
    const registry = resolved.map((action) => action.label);
    const buttoned = resolved
      .filter((action) => action.slot === 'primary' || action.slot === 'secondary')
      .map((action) => action.label);
    const { fromOverflow, fromContext } = await overflowThenContext({
      overflow: screen.getByRole('button', { name: 'More' }),
      context: screen.getByTestId('artifact-title'),
    });

    expect(buttoned.length).toBeGreaterThan(0);
    expect(fromOverflow).not.toContain('Open');
    expect(fromOverflow).toEqual(registry);
    expect(fromContext).toEqual(fromOverflow);
  });

  it('run page: the ⋯ and the right click list every action, buttons included, never Open run', async () => {
    const session = sessionFixture({ workflowRuns: [runFixture()] });
    seedActionState({
      useAppStore,
      seed: { session, workflows: [workflowFixture()], mounts: [mountFixture()] },
    });
    withMenus(<WorkflowRunDetail session={session} workflowRunId={RUN} />);
    const registry = (
      bindTarget({
        state: useAppStore.getState(),
        target: { kind: 'workflowRun', sessionId: SESSION, runId: RUN },
      })?.resolve({ viewing: { kind: 'workflowRun', id: RUN } }) ?? []
    ).map((action) => action.label);
    const { fromOverflow, fromContext } = await overflowThenContext({
      overflow: screen.getByRole('button', { name: /run actions$/ }),
      context: screen.getByRole('heading', { name: 'Settlement export' }),
    });

    expect(fromOverflow).not.toContain('Open run');
    expect(fromOverflow).toEqual(registry);
    expect(fromContext).toEqual(fromOverflow);
  });

  it('agent header: the ⋯ lists every action, buttons included, never Open agent', async () => {
    const agent = agentFixture({ status: 'failed' });
    seedActionState({ useAppStore, seed: { agents: [agent], mounts: [mountFixture()] } });
    withMenus(<AgentHeaderActions agent={agent} sessionId={SESSION} allowInterrupt />);
    const registry = (
      bindTarget({
        state: useAppStore.getState(),
        target: { kind: 'agent', sessionId: SESSION, agentId: AGENT },
      })?.resolve({ viewing: { kind: 'agent', id: AGENT } }) ?? []
    ).map((action) => action.label);
    fireEvent.click(screen.getByRole('button', { name: 'More agent actions' }));

    expect(menuLabels()).not.toContain('Open agent');
    expect(menuLabels()).toContain('Delete agent');
    expect(menuLabels()).toEqual(registry);
  });

  it('record header: the ⋯ plus its Open in tool button make the right click list', async () => {
    withMenus(
      <RecordHeader
        provider="gitlab"
        identifier="!87"
        title="Batch settlement writes for Northwind"
        externalRef={{
          url: 'https://gitlab.com/harborline/ledger-core/-/merge_requests/87',
          label: 'MR',
        }}
        verbs={{
          secondary: [],
          overflow: [
            {
              key: 'merge',
              label: 'Merge',
              icon: GitMerge,
              onRun: vi.fn(),
              isBusy: false,
              blockedReason: null,
              confirm: null,
            },
          ],
          destructive: [
            {
              key: 'close',
              label: 'Close merge request',
              icon: XCircle,
              onRun: vi.fn(),
              isBusy: false,
              blockedReason: null,
              confirm: {
                title: 'Close !87?',
                description: 'You can reopen it.',
                confirmLabel: 'Close',
              },
            },
          ],
        }}
      />,
    );
    const { fromOverflow, fromContext } = await overflowThenContext({
      overflow: screen.getByRole('button', { name: 'More actions for !87' }),
      context: screen.getByRole('heading', { level: 1 }),
    });
    expect(fromContext.filter((label) => label !== 'Open in GitLab')).toEqual(fromOverflow);
    expect(fromContext[0]).toBe('Open in GitLab');
  });

  it('commit row: the ⋯, the right click and Cmd+K on the focused row list the same actions in the same order', async () => {
    seedActionState({ useAppStore, seed: {} });
    const target: CommitActionTarget = {
      kind: 'commit',
      facts: {
        sha: 'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1',
        shortSha: 'b2c3d4e',
        subject: 'Keep trailing-comma rows in the ledger-core importer',
        isFolded: false,
        isRemoved: false,
        canRemove: true,
        canFoldDown: true,
        onRename: vi.fn(),
        onFoldDown: vi.fn(),
        onSquashDown: vi.fn(),
        onToggleRemove: vi.fn(),
        onSeparate: vi.fn(),
        onMove: vi.fn(),
      },
    };
    withMenus(
      <HistoryCommitRow
        sessionId={SESSION}
        commit={{
          sha: target.facts.sha,
          shortSha: target.facts.shortSha,
          subject: target.facts.subject,
          author: 'Mara Quill',
          timestamp: 1_790_000_000,
          pushed: false,
          parentSha: null,
        }}
        view="now"
        mark={null}
        titleOf={(sha) => sha}
        conflictFiles={[]}
        includes={[]}
        absorbed={[]}
        takenIn={[]}
        pills={{ isHead: true, remote: null, prNumber: null }}
        isNew={false}
        isHighlighted={false}
        isLifted={false}
        isDropInto={false}
        arrival={null}
        isInteractive
        isEditing={false}
        isExpanded={false}
        editor={null}
        nowMs={1_790_000_000_000}
        target={target}
        onPointerDown={vi.fn()}
        onHover={vi.fn()}
        onSeparate={vi.fn()}
        onModeChange={vi.fn()}
        onToggleExpanded={vi.fn()}
      />,
    );
    const row = document.querySelector(`[data-history-row="${target.facts.sha}"]`) as HTMLElement;
    const { fromOverflow, fromContext } = await overflowThenContext({
      overflow: screen.getByRole('button', { name: 'More for b2c3d4e' }),
      context: row,
    });
    await closeMenus();
    act(() => row.focus());
    render(
      <ToastProvider>
        <PaletteOverlay onClose={vi.fn()} />
      </ToastProvider>,
    );
    const fromPalette = screen
      .getAllByRole('option')
      .map((option) => option.getAttribute('aria-label') ?? '')
      .slice(0, fromOverflow.length);

    expect(fromOverflow).toEqual([
      'Rename',
      'Fold down',
      'Squash down',
      'Move up',
      'Move down',
      'Copy SHA',
      'Copy subject',
      'Remove',
    ]);
    expect(fromContext).toEqual(fromOverflow);
    expect(screen.getByText('For this commit')).toBeDefined();
    expect(fromPalette).toEqual(fromOverflow);
  });
});

describe('⌘K lists the same set as the registry, in the order of the state', () => {
  it('session verbs: the All actions level holds exactly the registry set', () => {
    seedActionState({
      useAppStore,
      seed: {
        mounts: [mountFixture()],
        branch: 'hl/payout-export',
        prUrl: 'https://example.test/pr/7',
      },
    });
    act(() => useAppStore.setState({ currentSessionId: SESSION }));
    const registry = (
      bindTarget({
        state: useAppStore.getState(),
        target: { kind: 'session', sessionId: SESSION },
      })?.resolve() ?? []
    )
      .filter((action) => action.blockedReason === null)
      .map((action) => action.label.replace(/^Open /, ''));
    render(
      <ToastProvider>
        <PaletteOverlay onClose={vi.fn()} />
      </ToastProvider>,
    );
    const firstScreen = optionLabels().filter((label) => !GOTO_LABELS.has(label));
    fireEvent.mouseDown(screen.getByRole('option', { name: 'All actions for this session' }));
    const level = optionLabels().map((label) => label.replace(/^Open /, '').replace(/…$/, ''));

    expect([...level].sort()).toEqual([...registry].sort());
    expect(firstScreen.some((label) => label === 'Rename')).toBe(true);
    expect(
      firstScreen.filter((label) => registry.includes(label.replace(/^Open /, ''))).length,
    ).toBeLessThanOrEqual(8);
  });

  it('run verbs: the Runs section lists only verbs of the run page', () => {
    const session = sessionFixture({ workflowRuns: [runFixture()] });
    seedActionState({
      useAppStore,
      seed: { session, workflows: [workflowFixture()], mounts: [mountFixture()] },
    });
    act(() => useAppStore.setState({ currentSessionId: SESSION }));
    const registry = (
      bindTarget({
        state: useAppStore.getState(),
        target: { kind: 'workflowRun', sessionId: SESSION, runId: RUN },
      })?.resolve() ?? []
    ).map((action) => action.label);
    render(
      <ToastProvider>
        <PaletteOverlay onClose={vi.fn()} />
      </ToastProvider>,
    );
    const labels = optionLabels();
    const runs = labels.slice(
      labels.indexOf('Settlement export'),
      labels.findIndex((label) => label === 'Board' || label === 'Open Runs'),
    );

    expect(runs[0]).toBe('Settlement export');
    for (const label of runs.slice(1)) {
      expect(registry).toContain(label.replace(/…$/, ''));
    }
  });
});

describe('menus open from the keyboard and never for a session that is gone', () => {
  it('opens the same menu from the keyboard with Shift+F10 and gives focus back on Escape', async () => {
    seedActionState({ useAppStore, seed: { mounts: [mountFixture()] } });
    withMenus(<StageBoardCard session={sessionFixture()} nav={NAV} />);
    const title = screen.getByRole('button', { name: /Speed up the payout export/ });
    title.focus();
    fireEvent.keyDown(title, { key: 'F10', code: 'F10', shiftKey: true });
    expect(screen.getByRole('menu', { name: 'Session actions' })).toBeDefined();
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    await act(async () => undefined);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement?.closest('article')).not.toBeNull();
  });

  it('never opens a menu for a session that is gone', async () => {
    seedActionState({ useAppStore, seed: {} });
    const { container } = withMenus(
      <StageBoardCard session={sessionFixture({ id: 'session-gone' as never })} nav={NAV} />,
    );
    fireEvent.contextMenu(container.querySelector('article') as HTMLElement);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(useAppStore.getState().sessions[0]?.id).toBe(SESSION);
  });
});
