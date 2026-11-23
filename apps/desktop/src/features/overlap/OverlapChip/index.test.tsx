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
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { anAgent, aSession } from '@goodboy/types/testing';
import { brandId, type AgentId, type MountId, type SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../store/storyHarness';
import type { AgentQueuedTurn } from '../../../store/slices/agentQueue/types';
import { liveMounts } from '../liveMounts';
import {
  NOT_SAVED,
  NOT_WITHDRAWN,
  RECIPIENT_GONE,
  SEND_AFTER_MS,
  STILL_QUEUED,
} from '../messageBothImplementers';
import { OverlapChip } from './index';

let useAppStore: StoryStore;

const RETRY_SESSION = brandId<SessionId>({ value: 's-398' });
const BATCH_SESSION = brandId<SessionId>({ value: 's-412' });
const RETRY_AGENT = brandId<AgentId>({ value: 'agent-retry' });
const BATCH_AGENT = brandId<AgentId>({ value: 'agent-batch' });
const RETRY_MOUNT = brandId<MountId>({ value: 'mount-retry' });
const BATCH_MOUNT = brandId<MountId>({ value: 'mount-batch' });

type MountParams = {
  readonly mountId: MountId;
  readonly sessionId: SessionId;
  readonly paths: ReadonlyArray<string>;
  readonly createdAt: number;
};

const mountRow = ({ mountId, sessionId, paths, createdAt }: MountParams) => ({
  mountId,
  sessionId,
  projectId: 'project-ledger',
  branch: mountId === RETRY_MOUNT ? 'hl/retry' : 'hl/batch',
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

const openAndSend = async () => {
  fireEvent.click(screen.getByRole('button', { name: /Overlaps/ }));
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Message both Implementers' }));
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

  it('names the other session, the shared file and the proposed order', async () => {
    await renderChip({ mountId: BATCH_MOUNT, placement: 'session' });

    fireEvent.click(screen.getByRole('button', { name: 'Overlaps Retry backoff' }));

    screen.getByText(
      'Both branches change src/retry/state.ts. Merge Retry backoff first: it changes 2 files, Batch export changes 3.',
    );
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
    expect(note).toContain('on branch hl/retry: src/retry/state.ts.');
    expect(note).toContain('Proposed merge order: hl/retry, then hl/batch.');

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
      [{ sessionId: BATCH_SESSION, agentId: BATCH_AGENT }],
      [{ sessionId: RETRY_SESSION, agentId: RETRY_AGENT }],
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
    screen.getByRole('button', { name: 'Message both Implementers' });
  });
});
