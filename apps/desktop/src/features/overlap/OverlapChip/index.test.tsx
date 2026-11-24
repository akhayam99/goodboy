// @vitest-environment happy-dom

type SaveArgs = Readonly<{ agentId: string; messages: ReadonlyArray<unknown> }>;

const h = vi.hoisted(() => ({
  saveAgentQueuedMessages: vi.fn(async (_args: SaveArgs) => undefined),
}));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../store/storyHarness')).dbModuleMock({
    saveAgentQueuedMessages: h.saveAgentQueuedMessages,
  }),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { anAgent, aSession } from '@goodboy/types/testing';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type MountId,
  type ProjectId,
  type SessionId,
} from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../store/storyHarness';
import type { AgentQueuedTurn } from '../../../store/slices/agentQueue/types';
import { branchPlace } from '../../../store/slices/navigation/place';
import { liveMounts } from '../liveMounts';
import {
  NOT_SAVED,
  NOT_WITHDRAWN,
  RECIPIENT_GONE,
  SEND_AFTER_MS,
  STILL_QUEUED,
} from '../messageImplementers';
import { OverlapChip } from './index';

let useAppStore: StoryStore;

const RETRY_SESSION = brandId<SessionId>({ value: 's-398' });
const BATCH_SESSION = brandId<SessionId>({ value: 's-412' });
const RETRY_AGENT = brandId<AgentId>({ value: 'agent-retry' });
const BATCH_AGENT = brandId<AgentId>({ value: 'agent-batch' });
const RETRY_MOUNT = brandId<MountId>({ value: 'mount-retry' });
const BATCH_MOUNT = brandId<MountId>({ value: 'mount-batch' });
const REFUND_SESSION = brandId<SessionId>({ value: 's-420' });
const REFUND_AGENT = brandId<AgentId>({ value: 'agent-refund' });
const REFUND_MOUNT = brandId<MountId>({ value: 'mount-refund' });
const REFUND_BRANCH = 'ak/payments-api-refund-the-northwind-statements';
const DEEP_PATH =
  'packages/ledger-core/src/reconcile/statements/export/reconciliationStatementExporter.ts';

type MountParams = {
  readonly mountId: MountId;
  readonly sessionId: SessionId;
  readonly paths: ReadonlyArray<string>;
  readonly createdAt: number;
  readonly branch?: string;
};

const mountRow = ({ mountId, sessionId, paths, createdAt, branch }: MountParams) => ({
  mountId,
  sessionId,
  projectId: 'project-ledger',
  branch: branch ?? (mountId === RETRY_MOUNT ? 'hl/retry' : 'hl/batch'),
  createdAt,
  port: 41000,
  hasFixedPort: false,
  paths,
});

const SHARED = [
  mountRow({
    mountId: RETRY_MOUNT,
    sessionId: RETRY_SESSION,
    paths: ['src/retry/state.ts', 'src/retry/backoff.ts'],
    createdAt: 1,
  }),
  mountRow({
    mountId: BATCH_MOUNT,
    sessionId: BATCH_SESSION,
    paths: ['src/retry/state.ts', 'src/batch/a.ts', 'src/batch/b.ts'],
    createdAt: 2,
  }),
];

const APART = [
  mountRow({ mountId: RETRY_MOUNT, sessionId: RETRY_SESSION, paths: ['a.ts'], createdAt: 1 }),
  mountRow({ mountId: BATCH_MOUNT, sessionId: BATCH_SESSION, paths: ['b.ts'], createdAt: 2 }),
];

type ChipParams = {
  readonly mountId: MountId;
  readonly placement: 'queue' | 'session';
};

const renderChip = async ({ mountId, placement }: ChipParams) => {
  render(<OverlapChip mountId={mountId} placement={placement} />);
  await act(async () => {
    await liveMounts.refresh();
  });
};

const queuedIds = (): ReadonlyArray<number> =>
  [RETRY_AGENT, BATCH_AGENT].map(
    (agentId) => useAppStore.getState().agentQueue[agentId]?.length ?? 0,
  );

type TextParams = {
  readonly element: Element;
};

const visibleText = ({ element }: TextParams): string => {
  const copy = element.cloneNode(true);
  if (!(copy instanceof Element)) {
    return '';
  }
  copy.querySelectorAll('.sr-only').forEach((hidden) => hidden.remove());
  return copy.textContent ?? '';
};

const stepTexts = (): ReadonlyArray<string> =>
  [...document.querySelectorAll('[data-merge-step]')].map((element) => visibleText({ element }));

const sharedPaths = (): ReadonlyArray<string | null> =>
  [...document.querySelectorAll('[data-shared-path]')].map((row) =>
    row.getAttribute('data-shared-path'),
  );

const openAndSend = async () => {
  fireEvent.click(screen.getByRole('button', { name: /Overlaps/ }));
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Message the Implementers' }));
  });
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  liveMounts.reset();
  h.saveAgentQueuedMessages.mockReset();
  h.saveAgentQueuedMessages.mockResolvedValue(undefined);
  stubStoryInvoke({ overlap_read: SHARED });
  useAppStore.setState({
    sessions: [
      aSession({ id: RETRY_SESSION, goal: 'Retry backoff' }),
      aSession({ id: BATCH_SESSION, goal: 'Batch export' }),
    ],
    sessionPhaseRuns: {
      [RETRY_SESSION]: [
        anAgent({
          id: RETRY_AGENT,
          sessionId: RETRY_SESSION,
          kind: 'implementer',
          mountId: RETRY_MOUNT,
          status: 'running',
        }),
      ],
      [BATCH_SESSION]: [
        anAgent({
          id: BATCH_AGENT,
          sessionId: BATCH_SESSION,
          kind: 'implementer',
          mountId: BATCH_MOUNT,
          status: 'running',
        }),
      ],
    },
  });
});

afterEach(() => {
  cleanup();
  liveMounts.reset();
  vi.useRealTimers();
});

describe('OverlapChip', () => {
  it('shows nothing when the two branches share no file', async () => {
    stubStoryInvoke({ overlap_read: APART });

    await renderChip({ mountId: BATCH_MOUNT, placement: 'session' });

    expect(screen.queryByRole('button', { name: /Overlaps/ })).toBeNull();
  });

  it('says the point, the order with its reasons and the shared file once', async () => {
    await renderChip({ mountId: BATCH_MOUNT, placement: 'session' });

    fireEvent.click(screen.getByRole('button', { name: 'Overlaps Retry backoff' }));

    const dialog = screen.getByRole('dialog', { name: '2 branches change the same files' });
    within(dialog).getByText('Merge them in this order to avoid conflicts.');
    expect(stepTexts()).toEqual([
      '1hl/retry2 filesRetry backoff · fewest files',
      '2hl/batchThis branch3 filesBatch export · most files',
    ]);
    within(dialog).getByText('1 shared file');
    expect(sharedPaths()).toEqual(['src/retry/state.ts']);
    expect(
      within(dialog)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Message the Implementers']);
  });

  it('names the task on the chip and the session title on its merge row', async () => {
    useAppStore.setState((state) => ({
      sessions: state.sessions.map((session) =>
        session.id === RETRY_SESSION ? { ...session, goal: '[HBL-412] Retry backoff' } : session,
      ),
      sessionExternalTasks: {
        [RETRY_SESSION]: [
          {
            sessionId: RETRY_SESSION,
            provider: 'linear',
            externalId: 'hbl-412',
            identifier: 'HBL-412',
            url: 'https://linear.app/harborline/issue/HBL-412',
            title: 'Retry backoff',
            createdAt: brandId<IsoDateTime>({ value: '2026-11-20T09:00:00.000Z' }),
          },
        ],
      },
    }));
    await renderChip({ mountId: BATCH_MOUNT, placement: 'session' });

    fireEvent.click(screen.getByRole('button', { name: 'Overlaps HBL-412' }));

    expect(stepTexts()[0]).toBe('1hl/retry2 filesRetry backoff · fewest files');
  });

  it('sits once on the Queue, on the row that merges second', async () => {
    await renderChip({ mountId: RETRY_MOUNT, placement: 'queue' });
    expect(screen.queryByRole('button', { name: /Overlaps/ })).toBeNull();
    cleanup();

    await renderChip({ mountId: BATCH_MOUNT, placement: 'queue' });
    screen.getByRole('button', { name: 'Overlaps Retry backoff' });
  });

  it('inside a session every overlapping row carries its chip', async () => {
    await renderChip({ mountId: RETRY_MOUNT, placement: 'session' });

    screen.getByRole('button', { name: 'Overlaps Batch export' });
  });

  it('queues one message per Implementer and Undo withdraws both', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await renderChip({ mountId: BATCH_MOUNT, placement: 'session' });

    await openAndSend();

    expect(queuedIds()).toEqual([1, 1]);
    const note = useAppStore.getState().agentQueue[BATCH_AGENT]?.[0]?.content ?? '';
    expect(note).toBe(
      'Your branch hl/batch changes the same files as hl/retry: src/retry/state.ts. Proposed merge order: hl/retry, then hl/batch.',
    );

    let isUndone = false;
    await act(async () => {
      isUndone = await useAppStore.getState().undoLastOperation();
    });

    expect(isUndone).toBe(true);
    expect(queuedIds()).toEqual([0, 0]);
  });

  it('sends after the Undo window, and Undo after a read keeps both messages', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const drainAgentQueue = vi.fn(async () => undefined);
    useAppStore.setState({ drainAgentQueue });
    await renderChip({ mountId: BATCH_MOUNT, placement: 'session' });
    await openAndSend();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEND_AFTER_MS);
    });

    expect(drainAgentQueue.mock.calls).toEqual([
      [{ sessionId: RETRY_SESSION, agentId: RETRY_AGENT }],
      [{ sessionId: BATCH_SESSION, agentId: BATCH_AGENT }],
    ]);

    const { agentQueue } = useAppStore.getState();
    const read: ReadonlyArray<AgentQueuedTurn> = (agentQueue[RETRY_AGENT] ?? []).map((item) => ({
      ...item,
      status: 'sending',
    }));
    useAppStore.setState({ agentQueue: { ...agentQueue, [RETRY_AGENT]: read } });
    let isUndone = true;
    await act(async () => {
      isUndone = await useAppStore.getState().undoLastOperation({ shouldAnnounce: false });
    });

    expect(isUndone).toBe(false);
    expect(queuedIds()).toEqual([1, 1]);
  });

  it('a failed save sends nothing, says why and Retry sends both', async () => {
    h.saveAgentQueuedMessages.mockRejectedValue(new Error('disk full'));
    await renderChip({ mountId: BATCH_MOUNT, placement: 'session' });

    await openAndSend();

    screen.getByText(NOT_SAVED);
    expect(queuedIds()).toEqual([0, 0]);

    h.saveAgentQueuedMessages.mockResolvedValue(undefined);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });

    expect(queuedIds()).toEqual([1, 1]);
    expect(screen.queryByText(NOT_SAVED)).toBeNull();
  });

  it('a turn that finishes inside the Undo window does not deliver either note', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await renderChip({ mountId: BATCH_MOUNT, placement: 'session' });
    await openAndSend();

    await act(async () => {
      await useAppStore
        .getState()
        .drainAgentQueue({ sessionId: RETRY_SESSION, agentId: RETRY_AGENT });
      await useAppStore
        .getState()
        .drainAgentQueue({ sessionId: BATCH_SESSION, agentId: BATCH_AGENT });
    });

    const heads = [RETRY_AGENT, BATCH_AGENT].map(
      (agentId) => useAppStore.getState().agentQueue[agentId]?.[0],
    );
    expect(heads.map((turn) => turn?.status)).toEqual(['queued', 'queued']);
    expect(heads.every((turn) => turn?.hold !== undefined)).toBe(true);
  });

  it('a withdrawal that cannot be saved makes Undo fail and keeps both notes', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const reportError = vi.fn(async () => undefined);
    useAppStore.setState({ reportError });
    await renderChip({ mountId: BATCH_MOUNT, placement: 'session' });
    await openAndSend();
    h.saveAgentQueuedMessages.mockRejectedValue(new Error('disk full'));

    let isUndone = true;
    await act(async () => {
      isUndone = await useAppStore.getState().undoLastOperation({ shouldAnnounce: false });
    });

    expect(isUndone).toBe(false);
    expect(queuedIds()).toEqual([1, 1]);
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ error: new Error(NOT_WITHDRAWN) }),
    );
  });

  it('a rollback that cannot withdraw says so and Retry adds no duplicate', async () => {
    h.saveAgentQueuedMessages.mockImplementation(async ({ agentId, messages }) => {
      if (agentId === BATCH_AGENT || messages.length === 0) {
        throw new Error('disk full');
      }
    });
    await renderChip({ mountId: BATCH_MOUNT, placement: 'session' });

    await openAndSend();

    screen.getByText(STILL_QUEUED);
    expect(queuedIds()).toEqual([1, 0]);

    h.saveAgentQueuedMessages.mockReset();
    h.saveAgentQueuedMessages.mockResolvedValue(undefined);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });

    expect(queuedIds()).toEqual([1, 1]);
  });

  it('Retry keeps the failed recipients and says when one is gone', async () => {
    h.saveAgentQueuedMessages.mockRejectedValue(new Error('disk full'));
    await renderChip({ mountId: BATCH_MOUNT, placement: 'session' });
    await openAndSend();
    screen.getByText(NOT_SAVED);

    const replacement = brandId<AgentId>({ value: 'agent-batch-2' });
    act(() => {
      useAppStore.setState((state) => ({
        sessionPhaseRuns: {
          ...state.sessionPhaseRuns,
          [BATCH_SESSION]: [
            anAgent({
              id: replacement,
              sessionId: BATCH_SESSION,
              kind: 'implementer',
              mountId: BATCH_MOUNT,
              status: 'running',
            }),
          ],
        },
      }));
    });
    h.saveAgentQueuedMessages.mockResolvedValue(undefined);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });

    screen.getByText(RECIPIENT_GONE);
    expect(useAppStore.getState().agentQueue[replacement]).toBeUndefined();
    expect(queuedIds()).toEqual([0, 0]);
    screen.getByRole('button', { name: 'Message the Implementers' });
  });

  it('keeps saying why when Retry finds every Implementer gone', async () => {
    h.saveAgentQueuedMessages.mockRejectedValue(new Error('disk full'));
    await renderChip({ mountId: BATCH_MOUNT, placement: 'session' });
    await openAndSend();
    screen.getByText(NOT_SAVED);

    act(() => {
      useAppStore.setState({ sessionPhaseRuns: {} });
    });
    h.saveAgentQueuedMessages.mockResolvedValue(undefined);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });

    screen.getByText(RECIPIENT_GONE);
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(queuedIds()).toEqual([0, 0]);
  });
});

const THREE = [
  mountRow({
    mountId: REFUND_MOUNT,
    sessionId: REFUND_SESSION,
    branch: REFUND_BRANCH,
    paths: ['src/ledger/totals.ts', 'src/ledger/round.ts', DEEP_PATH, 'src/ledger/fees.ts'],
    createdAt: 1,
  }),
  mountRow({
    mountId: RETRY_MOUNT,
    sessionId: RETRY_SESSION,
    paths: ['src/ledger/totals.ts', 'src/retry/a.ts', 'src/retry/b.ts', 'src/retry/c.ts'],
    createdAt: 3,
  }),
  mountRow({
    mountId: BATCH_MOUNT,
    sessionId: BATCH_SESSION,
    paths: [
      'src/ledger/totals.ts',
      'src/ledger/round.ts',
      DEEP_PATH,
      'src/ledger/fees.ts',
      'src/batch/a.ts',
      'src/batch/b.ts',
    ],
    createdAt: 2,
  }),
];

const openThree = async () => {
  await renderChip({ mountId: BATCH_MOUNT, placement: 'session' });
  fireEvent.click(screen.getByRole('button', { name: 'Overlaps Refund statements +1' }));
  return screen.getByRole('dialog', { name: '3 branches change the same files' });
};

describe('OverlapChip with three branches', () => {
  beforeEach(() => {
    stubStoryInvoke({ overlap_read: THREE });
    useAppStore.setState((state) => ({
      sessions: [...state.sessions, aSession({ id: REFUND_SESSION, goal: 'Refund statements' })],
      sessionPhaseRuns: {
        ...state.sessionPhaseRuns,
        [REFUND_SESSION]: [
          anAgent({
            id: REFUND_AGENT,
            sessionId: REFUND_SESSION,
            kind: 'implementer',
            mountId: REFUND_MOUNT,
            status: 'running',
          }),
        ],
      },
    }));
  });

  it('lists each branch once in merge order, marks this one and says why', async () => {
    await openThree();

    expect(stepTexts()).toEqual([
      `1${REFUND_BRANCH}4 filesRefund statements · started earlier`,
      '2hl/retry4 filesRetry backoff · fewer files',
      '3hl/batchThis branch6 filesBatch export · most files',
    ]);
    const own = document.querySelector('[aria-current="true"]');
    expect(own?.getAttribute('data-merge-step')).toBe(BATCH_MOUNT);
  });

  it('cuts a long branch and a long path in the middle and keeps the full name', async () => {
    await openThree();

    const branch = document.querySelector(`[data-merge-step="${REFUND_MOUNT}"] [data-branch]`);
    const path = document.querySelector('[data-shared-path*="reconciliation"]');
    expect(branch?.getAttribute('data-branch')).toBe(REFUND_BRANCH);
    expect(path?.getAttribute('data-shared-path')).toBe(DEEP_PATH);
    for (const [cut, full] of [
      [branch, REFUND_BRANCH],
      [path, DEEP_PATH],
    ] as const) {
      const [head, tail] = [...(cut?.querySelectorAll('[aria-hidden]') ?? [])];
      expect(cut?.textContent).toContain(full);
      expect(`${head?.textContent ?? ''}${tail?.textContent ?? ''}`).toBe(full);
      expect((tail?.textContent ?? '').length).toBeLessThanOrEqual(24);
    }
  });

  it('names the shared files once and shows the rest in place', async () => {
    const dialog = await openThree();

    within(dialog).getByText('4 shared files');
    expect(sharedPaths()).toEqual(['src/ledger/totals.ts', 'src/ledger/round.ts', DEEP_PATH]);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Show 1 more' }));

    expect(sharedPaths()).toEqual([
      'src/ledger/totals.ts',
      'src/ledger/round.ts',
      DEEP_PATH,
      'src/ledger/fees.ts',
    ]);
    expect(within(dialog).queryByRole('button', { name: /^Show/ })).toBeNull();
  });

  it('messages every Implementer once with the order', async () => {
    await openThree();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Message the Implementers' }));
    });

    const notes = [REFUND_AGENT, RETRY_AGENT, BATCH_AGENT].map(
      (agentId) => useAppStore.getState().agentQueue[agentId]?.map((turn) => turn.content) ?? [],
    );
    const shared = `src/ledger/totals.ts, src/ledger/round.ts, ${DEEP_PATH}, src/ledger/fees.ts`;
    const order = `Proposed merge order: ${REFUND_BRANCH}, then hl/retry, then hl/batch.`;
    expect(notes).toEqual([
      [`Your branch ${REFUND_BRANCH} changes the same files as hl/batch: ${shared}. ${order}`],
      [`Your branch hl/retry changes the same files as hl/batch: src/ledger/totals.ts. ${order}`],
      [
        `Your branch hl/batch changes the same files as ${REFUND_BRANCH} and hl/retry: ${shared}. ${order}`,
      ],
    ]);
  });

  it('opens this branch in Changes on the first shared file', async () => {
    const navigate = vi.fn();
    useAppStore.setState({
      navigate,
      sessionProjectMounts: {
        [BATCH_SESSION]: [
          {
            mountId: BATCH_MOUNT,
            sessionId: BATCH_SESSION,
            projectId: brandId<ProjectId>({ value: 'project-ledger' }),
            mountName: 'ledger-core',
            worktreePath: '/work/ledger-core-batch',
            lastWorktreePath: null,
            repoRoot: '/work/ledger-core',
            branch: 'hl/batch',
            baseBranch: null,
            parallelIndex: 0,
            isAttached: true,
            diskState: 'present',
            revision: 1,
          },
        ],
      },
    });
    const dialog = await openThree();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Open in Changes' }));

    expect(navigate).toHaveBeenCalledWith({
      to: branchPlace({
        sessionId: BATCH_SESSION,
        mountPath: '/work/ledger-core-batch',
        tab: 'files',
        focus: { kind: 'branch', path: 'src/ledger/totals.ts' },
      }),
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows no chip on the Queue for the branch that merges first', async () => {
    await renderChip({ mountId: REFUND_MOUNT, placement: 'queue' });

    expect(screen.queryByRole('button', { name: /Overlaps/ })).toBeNull();
  });
});
