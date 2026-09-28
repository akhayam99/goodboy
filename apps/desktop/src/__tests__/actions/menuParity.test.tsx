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
import type { ArtifactActionTarget } from '../../features/actions/types';
import type { RunnableScript } from '../../features/scripts/buildSessionScripts';
import {
  AGENT,
  FIXTURE_NOW,
  SESSION,
  mountFixture,
  seedActionState,
  sessionFixture,
} from '../helpers/actionFixtures';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const withMenus = (node: ReactNode) => render(<ObjectMenuProvider>{node}</ObjectMenuProvider>);

const menuLabels = (): ReadonlyArray<string> =>
  screen
    .getAllByRole('menuitem')
    .map((item) => item.getAttribute('data-menu-label') ?? item.textContent ?? '');

const closeMenus = async (): Promise<void> => {
  await act(async () => {
    fireEvent.mouseDown(document.body);
  });
};

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
    const registry = (bindTarget({ state: useAppStore.getState(), target })?.resolve() ?? []).map(
      (action) => action.label,
    );
    const buttoned = (bindTarget({ state: useAppStore.getState(), target })?.resolve() ?? [])
      .filter((action) => action.slot === 'primary' || action.slot === 'secondary')
      .map((action) => action.label);
    const { fromOverflow, fromContext } = await overflowThenContext({
      overflow: screen.getByRole('button', { name: 'More' }),
      context: screen.getByTestId('artifact-title'),
    });

    expect(buttoned.length).toBeGreaterThan(0);
    expect(fromOverflow).toEqual(registry);
    expect(fromContext).toEqual(fromOverflow);
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
