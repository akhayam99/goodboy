// @vitest-environment happy-dom

import { cleanup, render, screen, within, type RenderResult } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAutoTree,
  insertProject,
  insertWorkspace,
  listAutoAttemptsOfTree,
  listAutoDelegations,
  listAutoReservations,
  readAutoTreeSpend,
} from '@goodboy/db';
import type {
  AgentId,
  AutoTreeId,
  IsoDateTime,
  ProjectId,
  ProviderRunId,
  SessionId,
  TurnEvent,
  WorkspaceId,
} from '@goodboy/types';
import { railRowsOf } from '../../features/auto/chat/railRowsOf';
import { autoSpawnedRowsOf } from '../../app/components/SpawnedPanel/autoSpawnedRowsOf';
import type { SpawnedRow } from '../../app/components/SpawnedPanel/spawnedRow';
import { spawnedRailOf } from '../../app/components/SpawnedPanel/spawnedRailOf';
import { SpawnedTree } from '../../app/components/SpawnedPanel/SpawnedTree';
import { SpawnedTreeRow } from '../../app/components/SpawnedPanel/SpawnedTreeRow';
import { brandedId } from '../../features/history/testing/brandedId';
import { stubProviderRouting } from '../helpers/journeyHarness';
import { makeAutoRuntime } from '../../store/runtime/auto/makeAutoRuntime';
import { runAutoCommand } from '../../store/runtime/auto/runAutoCommand';
import { startAutoTree } from '../../store/runtime/auto/startAutoTrees';
import type { AutoRuntime } from '../../store/runtime/auto/createAutoRuntime';
import {
  buildStoryProject,
  buildStoryWorkspace,
  connectedAnthropicState,
  importStore,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  STORE_IMPORT_TIMEOUT_MS,
  storySpies,
  storySqlite,
  stubStoryInvoke,
  type StoryStore,
} from '../../store/storyHarness';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../shared/lib/db', async () =>
  (await import('../../store/storyHarness')).sqliteDbLibModuleMock(),
);
vi.mock('../../features/chat/turn', async () =>
  (await import('../../store/storyHarness')).turnModuleMock(),
);
vi.mock('../../features/permissions/permissions', async () =>
  (await import('../../store/storyHarness')).permissionsModuleMock(),
);
vi.mock('../../features/providers/providers', async () =>
  (await import('../../store/storyHarness')).providersModuleMock(),
);
vi.mock('../../features/providers/routing', async () =>
  (await import('../../store/storyHarness')).routingModuleMock(),
);
vi.mock('../../features/budget/budget', async () =>
  (await import('../../store/storyHarness')).budgetModuleMock(),
);
vi.mock('../../features/worktree/worktree', async () =>
  (await import('../../store/storyHarness')).worktreeModuleMock(),
);
vi.mock('../../shared/lib/repo', async () =>
  (await import('../../store/storyHarness')).repoModuleMock(),
);
vi.mock('../../features/plans/plans', async () =>
  (await import('../../store/storyHarness')).plansModuleMock(),
);

const WORKSPACE_ID = brandedId<WorkspaceId>({ value: 'workspace-harborline' });
const PROJECT_ID = brandedId<ProjectId>({ value: 'project-ledger-core' });
const AT = brandedId<IsoDateTime>({ value: '2026-10-16T09:00:00.000Z' });

const workspace = buildStoryWorkspace({ id: WORKSPACE_ID, name: 'Harborline', slug: 'harborline' });
const project = buildStoryProject({
  id: PROJECT_ID,
  workspaceId: WORKSPACE_ID,
  name: 'ledger-core',
  rootPath: '/tmp/ledger-core',
});

type RunArgs = {
  readonly runId: ProviderRunId;
  readonly prompt: string;
  readonly confinedRole?: string;
  readonly deliveryId?: string;
};

type Gate = {
  readonly opened: Promise<void>;
  readonly open: () => void;
};

const REPORT = `<<artifact v=1 kind=report>>\n${JSON.stringify({
  title: 'Callers of the ledger export',
  format: 'markdown',
  content: 'exportLedger and nightlyExport call it.',
})}\n<</artifact>>`;

const gate = (): Gate => {
  let open: () => void = () => undefined;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { opened, open };
};

let useAppStore: StoryStore;
let runtime: AutoRuntime;
let sessionId: SessionId;
let rootId: AgentId;
let treeId: AutoTreeId;
let childGate: Gate;
let isReportWithheld: boolean;
const autoPrompts: Array<string> = [];
const childPrompts: Array<string> = [];
const deliveryRuns = new Map<string, string>();

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const text = ({ runId, delta }: { readonly runId: ProviderRunId; readonly delta: string }) =>
  ({ kind: 'assistant_text', runId, delta, at: AT }) satisfies TurnEvent;

const delegateScout = async ({ runId }: { readonly runId: ProviderRunId }) =>
  runAutoCommand({
    ctx: runtime.ctx,
    command: {
      verb: 'delegate',
      args: {
        'request-id': 'request-1',
        spec: JSON.stringify({
          children: [
            {
              role: 'scout',
              task: 'find the callers of the ledger export in ledger-core',
              reason: 'read only search',
            },
          ],
        }),
      },
      grant: {
        agentId: rootId,
        treeId,
        generation: 1,
        workspaceId: WORKSPACE_ID,
        sessionId,
        runId,
      },
    },
  });

const childIdOf = async ({ deliveryId }: { readonly deliveryId: string }) => {
  const attempts = await listAutoAttemptsOfTree({ db: storySqlite(), treeId });
  const attempt = attempts.find((entry) => entry.id === deliveryId);
  const delegations = await listAutoDelegations({ db: storySqlite(), treeId });
  return delegations.find((entry) => entry.id === attempt?.delegationId)?.childAgentId ?? '';
};

const scriptedTurn = async ({ args }: { readonly args: RunArgs }): Promise<Array<TurnEvent>> => {
  if (args.confinedRole === 'auto') {
    autoPrompts.push(args.prompt);
    if (autoPrompts.length === 1) {
      await waitForAccepted({ runId: args.runId });
      await delegateScout({ runId: args.runId });
      return [text({ runId: args.runId, delta: 'Starting a scout on the ledger export.' })];
    }
    return [text({ runId: args.runId, delta: 'The scout found two callers. Nothing else to do.' })];
  }
  childPrompts.push(args.prompt);
  await childGate.opened;
  const childId = await childIdOf({ deliveryId: args.deliveryId ?? '' });
  const report = isReportWithheld ? '' : `${REPORT}\n`;
  return [
    text({
      runId: args.runId,
      delta: `Two callers: exportLedger and nightlyExport.\n${report}<<step-done id="${childId}">>`,
    }),
  ];
};

beforeEach(async () => {
  await resetStoryStore();
  autoPrompts.length = 0;
  childPrompts.length = 0;
  deliveryRuns.clear();
  childGate = gate();
  isReportWithheld = false;
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace });
  await insertProject({ db, project });
  stubStoryInvoke({
    workspaces_with_unread: [],
    workflow_list: [],
    gh_run: { stdout: '', stderr: 'no git remotes found', exitCode: 1 },
  });
  await stubProviderRouting();
  storySpies.scratchDirPrepare.mockResolvedValue('/tmp/goodboy-root/scratch/harborline');
  storySpies.runTurn.mockImplementation((args: RunArgs) => {
    deliveryRuns.set(args.deliveryId ?? args.runId, args.runId);
    return (async function* stream(): AsyncIterable<TurnEvent> {
      for (const event of await scriptedTurn({ args })) {
        yield event;
      }
    })();
  });
  const turn = await import('../../features/chat/turn');
  vi.mocked(turn.lookupDeliveryRun).mockImplementation(async ({ deliveryId }) => {
    const runId = deliveryRuns.get(deliveryId);
    return runId === undefined ? null : { runId, isLive: true };
  });
  useAppStore.setState({
    workspaces: [workspace],
    currentWorkspaceId: WORKSPACE_ID,
    projects: [project],
    sessions: [],
    archivedSessions: {},
    ...connectedAnthropicState(),
  });
  const { session } = await useAppStore.getState().createSession({
    workspaceId: WORKSPACE_ID,
    projectId: PROJECT_ID,
    goal: 'Find who calls the ledger export',
  });
  sessionId = session.id;
  rootId = await useAppStore
    .getState()
    .spawnAgent(sessionId, { kindOverride: 'auto', name: 'Auto' });
  runtime = makeAutoRuntime({
    db,
    getState: useAppStore.getState,
    sleep: () => new Promise<void>((resolve) => setImmediate(resolve)),
    watchPolls: 3,
  });
});

afterEach(async () => {
  cleanup();
  childGate.open();
  await runtime.settled();
});

const waitForAccepted = async ({ runId }: { readonly runId: ProviderRunId }) => {
  const db = storySqlite();
  await vi.waitFor(async () => {
    expect((await getAutoTree({ db, treeId }))?.activeRunId).toBe(runId);
  });
};

const treePhase = async () => (await getAutoTree({ db: storySqlite(), treeId }))?.phase;

const attemptReservations = async () =>
  (await listAutoReservations({ db: storySqlite(), treeId })).filter(
    (reservation) => reservation.ownerKind === 'attempt',
  );

type WorkTreeParams = {
  readonly rows: ReadonlyArray<SpawnedRow>;
};

const workTree = ({ rows }: WorkTreeParams) => {
  const rail = spawnedRailOf({
    nodes: rows.map((row) => ({ id: row.id, level: row.level, isPending: false })),
  });
  return (
    <SpawnedTree label="Work">
      {rows
        .flatMap((row) => {
          const rowRail = rail.railById.get(row.id);
          return rowRail === undefined ? [] : [{ row, rowRail }];
        })
        .map(({ row, rowRail }) => (
          <SpawnedTreeRow
            key={row.id}
            id={row.id}
            level={row.level}
            hasChildren={row.hasChildren}
            rail={rowRail}
            railWidth={rail.width}
            glyph={null}
            role={row.role}
            title={row.title}
            card={row.card}
            word={row.word}
            time={null}
            isSelected={false}
            onOpen={() => undefined}
          />
        ))}
    </SpawnedTree>
  );
};

const showRail = async (view: RenderResult) => {
  await useAppStore.getState().loadAutoTrees({ sessionId });
  const [treeView] = useAppStore.getState().autoTreeViews[sessionId] ?? [];
  if (treeView === undefined) {
    throw new Error('the Auto tree has no view');
  }
  view.rerender(
    workTree({
      rows: autoSpawnedRowsOf({
        rows: railRowsOf({
          view: treeView,
          agents: useAppStore.getState().sessionPhaseRuns[sessionId] ?? [],
          rootRouting: { provider: null, model: null, effort: null },
        }),
        baseLevel: 1,
      }),
    }),
  );
  return within(screen.getByRole('tree', { name: 'Work' }))
    .getAllByRole('treeitem')
    .map((item) => item.getAttribute('aria-label') ?? '');
};

const openTree = async () => {
  const started = await startAutoTree({
    ctx: runtime.ctx,
    agent: { agentId: rootId, sessionId, workspaceId: WORKSPACE_ID },
    sessionCapUsd: () => 5,
    workspaceLimitUsd: async () => null,
  });
  treeId = started.tree.id;
};

describe('journey: Auto delegates and a child finishes', () => {
  it('runs the parent, starts the child, and hands the result back', async () => {
    const db = storySqlite();
    const view = render(workTree({ rows: [] }));
    await openTree();
    expect(await treePhase()).toBe('answering');
    expect(await listAutoDelegations({ db, treeId })).toEqual([]);
    expect(await showRail(view)).toHaveLength(1);

    await runtime.say({ treeId, text: 'Find who calls the ledger export' });

    await vi.waitFor(async () => expect(await listAutoDelegations({ db, treeId })).toHaveLength(1));
    const [delegation] = await listAutoDelegations({ db, treeId });
    expect(delegation).toMatchObject({ role: 'scout', outcome: null });
    expect(autoPrompts).toHaveLength(1);
    expect(autoPrompts[0]).toContain('Find who calls the ledger export');

    await vi.waitFor(async () => expect(childPrompts).toHaveLength(1));
    expect(childPrompts[0]).toContain('find the callers of the ledger export in ledger-core');
    await vi.waitFor(async () => expect(await treePhase()).toBe('waiting'));
    const attempts = await listAutoAttemptsOfTree({ db, treeId });
    expect(attempts.map((attempt) => attempt.state)).toEqual(['running']);
    const reserved = await attemptReservations();
    expect(reserved.map((reservation) => reservation.state)).toEqual(['reserved']);
    expect((await readAutoTreeSpend({ db, treeId }))?.reservedUsd).toBe(0);
    const childId = delegation?.childAgentId ?? '';
    expect(useAppStore.getState().sessionPhaseRuns[sessionId]?.map((agent) => agent.id)).toContain(
      childId,
    );
    const working = await showRail(view);
    expect(working).toHaveLength(2);
    expect(working[0]).toContain('Auto');
    expect(working[0]).toContain('Running');
    expect(working[1]).toContain('Scout');
    expect(working[1]).toContain('Running');
    expect(autoPrompts).toHaveLength(1);

    childGate.open();

    await vi.waitFor(async () => expect(autoPrompts).toHaveLength(2));
    expect(autoPrompts[1]).toContain('RESULTS FROM YOUR AGENTS');
    expect(autoPrompts[1]).toContain('exportLedger and nightlyExport');
    const [settled] = await listAutoDelegations({ db, treeId });
    expect(settled).toMatchObject({ state: 'settled', outcome: 'completed' });
    expect((await attemptReservations()).map((reservation) => reservation.state)).toEqual([
      'reconciled',
    ]);

    await runtime.settled();
    await vi.waitFor(async () => expect(await treePhase()).toBe('done'));
    expect(
      await rowsOf<{ reserved: number }>({
        sql: "SELECT COUNT(*) AS reserved FROM auto_reservations WHERE state = 'reserved'",
      }),
    ).toEqual([{ reserved: 0 }]);
    const finished = await showRail(view);
    expect(finished[0]).toContain('Idle');
    expect(finished[1]).toContain('Done');
  });

  it('tells the parent a child failed when it ends without its report, and still settles the reservation', async () => {
    const db = storySqlite();
    isReportWithheld = true;
    await openTree();

    await runtime.say({ treeId, text: 'Find who calls the ledger export' });

    await vi.waitFor(async () => expect(childPrompts).toHaveLength(1));
    await vi.waitFor(async () => expect(await treePhase()).toBe('waiting'));
    expect((await attemptReservations()).map((reservation) => reservation.state)).toEqual([
      'reserved',
    ]);

    childGate.open();

    await vi.waitFor(async () => expect(autoPrompts).toHaveLength(2));
    expect(autoPrompts[1]).toContain('RESULTS FROM YOUR AGENTS');
    expect(autoPrompts[1]).toContain('failed, report_missing');
    const [settled] = await listAutoDelegations({ db, treeId });
    expect(settled).toMatchObject({ state: 'settled', outcome: 'failed' });
    expect((await attemptReservations()).map((reservation) => reservation.state)).toEqual([
      'reconciled',
    ]);
    await runtime.settled();
    await vi.waitFor(async () => expect(await treePhase()).toBe('done'));
    expect(
      await rowsOf<{ reserved: number }>({
        sql: "SELECT COUNT(*) AS reserved FROM auto_reservations WHERE state = 'reserved'",
      }),
    ).toEqual([{ reserved: 0 }]);
  });
});
