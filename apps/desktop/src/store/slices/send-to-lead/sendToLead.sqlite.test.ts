// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).sqliteDbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AutoPhase } from '@goodboy/db';
import { getAgentById, insertAgent } from '@goodboy/db';
import { brandId, type MountId, type WorkspaceId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  injectDbFault,
  openStorySqlite,
  resetStoryStore,
  storySqlite,
  type StoryStore,
} from '../../storyHarness';
import {
  FIXTURE_ROOT,
  FIXTURE_SESSION,
  FIXTURE_TREE,
  aView,
} from '../../../features/auto/testing/autoViewFixtures';
import type { LeadCandidate } from '../../../features/work/sendToLead/leadCandidatesOf';
import { registerWithdrawPort } from '../../../features/auto/withdrawPort';
import { sentToLeadStatusOf } from '../../../features/work/sendToLead/sentToLeadStatusOf';
import { SEND_TO_LEAD_COPY } from '../../../features/work/sendToLead/sendToLeadCopy';
import type { SendToLeadItem } from './types';

const WORKSPACE = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const THREAD = 'PRRT_harborline_ledger_batch';
const KEY = 'move:changes-requested-79';

let useAppStore: StoryStore;

const CANDIDATE: LeadCandidate = {
  treeId: FIXTURE_TREE,
  rootAgentId: FIXTURE_ROOT,
  sessionId: FIXTURE_SESSION,
  title: 'HBL-417',
  stateWord: 'Working',
  reason: 'Holds #79',
  rule: 'holds',
};

const ITEM: SendToLeadItem = {
  key: KEY,
  sessionId: FIXTURE_SESSION,
  text: 'A review comment for you to work on.',
  note: '',
  threadId: THREAD,
  mountId: brandId<MountId>({ value: 'mount-ledger-batch' }),
  branch: 'hl/ledger-batch',
};

type LeadParams = {
  readonly phase?: AutoPhase;
};

const seedLead = async ({ phase = 'answering' }: LeadParams = {}): Promise<void> => {
  const lead = await insertAgent(storySqlite(), {
    id: FIXTURE_ROOT,
    sessionId: FIXTURE_SESSION,
    ordinal: 0,
    name: 'Lead',
    status: 'running',
    kind: 'auto',
  });
  useAppStore.setState({
    sessions: [aSession({ id: FIXTURE_SESSION, workspaceId: WORKSPACE })],
    sessionPhaseRuns: { [FIXTURE_SESSION]: [lead] },
    workWorkspaceId: WORKSPACE,
    workLeads: [
      {
        treeId: FIXTURE_TREE,
        sessionId: FIXTURE_SESSION,
        sessionGoal: 'HBL-417',
        projectId: 'project-ledger-core',
        branches: ['hl/ledger-batch'],
        projectIds: ['project-ledger-core'],
        view: aView({ phase }),
      },
    ],
  });
};

const entry = () => useAppStore.getState().sentToLead[KEY];

const queue = () => useAppStore.getState().agentQueue[FIXTURE_ROOT] ?? [];

const statusNow = () => {
  const current = entry();
  if (current === undefined) {
    return null;
  }
  return sentToLeadStatusOf({
    entry: current,
    queue: queue(),
    views: useAppStore.getState().workLeads.map((lead) => lead.view),
  }).kind;
};

const storedThreads = async () =>
  (await getAgentById(storySqlite(), FIXTURE_ROOT))?.sourceThreadIds ?? [];

const drain = vi.fn(async () => undefined);

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  drain.mockClear();
  useAppStore.setState({ drainAgentQueue: drain, loadWorkLeads: vi.fn(async () => undefined) });
  const db = await openStorySqlite();
  await db.execute(
    'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, 1, 1)',
    [WORKSPACE, 'Harborline', 'harborline'],
  );
  await db.execute(
    'INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, 1, 1)',
    [FIXTURE_SESSION, WORKSPACE, 'HBL-417', 'idle'],
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Send to Lead', () => {
  it('queues the item for the Lead, binds the comment, drains, and reads Not read yet', async () => {
    await seedLead();

    await useAppStore.getState().sendToLead({ ...ITEM, candidate: CANDIDATE });

    expect(entry()?.phase).toBe('sent');
    expect(queue().map((turn) => [turn.content, turn.sourceThreadId])).toEqual([
      [ITEM.text, THREAD],
    ]);
    expect(await storedThreads()).toEqual([THREAD]);
    expect(drain).toHaveBeenCalledWith({ sessionId: FIXTURE_SESSION, agentId: FIXTURE_ROOT });
    expect(statusNow()).toBe('notRead');
  });

  it('reads is on it once the Lead took the message', async () => {
    await seedLead();
    await useAppStore.getState().sendToLead({ ...ITEM, candidate: CANDIDATE });

    useAppStore.setState({ agentQueue: {} });

    expect(statusNow()).toBe('onIt');
  });

  it('Undo takes the message back and frees the comment, until the Lead reads it', async () => {
    await seedLead();
    await useAppStore.getState().sendToLead({ ...ITEM, candidate: CANDIDATE });

    await useAppStore.getState().undoSendToLead({ key: KEY });

    expect(entry()).toBeUndefined();
    expect(queue()).toHaveLength(0);
    expect(await storedThreads()).toEqual([]);
  });

  it('Undo withdraws a message the drain already moved to the outbox', async () => {
    await seedLead();
    await useAppStore.getState().sendToLead({ ...ITEM, candidate: CANDIDATE });
    const withdraw = vi.fn(async () => ({ kind: 'withdrawn' as const }));
    registerWithdrawPort({ port: withdraw });
    useAppStore.setState((state) => ({
      agentQueue: {},
      workLeads: state.workLeads.map((lead) => ({
        ...lead,
        view: aView({
          pendingMessages: [{ rowId: '41', createdAt: 1, text: ITEM.text, images: [] }],
        }),
      })),
    }));
    expect(statusNow()).toBe('notRead');

    await useAppStore.getState().undoSendToLead({ key: KEY });

    expect(withdraw).toHaveBeenCalledWith({ treeId: FIXTURE_TREE, rowId: '41' });
    expect(entry()).toBeUndefined();
    expect(await storedThreads()).toEqual([]);
  });

  it('says Not delivered when the Lead stopped between the choice and the click', async () => {
    await seedLead({ phase: 'stopped' });

    await useAppStore.getState().sendToLead({ ...ITEM, candidate: CANDIDATE });

    expect(entry()?.phase).toBe('stopped');
    expect(entry()?.failure).toBe(SEND_TO_LEAD_COPY.notDelivered);
    expect(queue()).toHaveLength(0);
    expect(await storedThreads()).toEqual([]);
  });

  it('keeps the item with Retry when the message cannot be saved, and Retry sends it', async () => {
    await seedLead();
    injectDbFault({ match: /agent_queued_messages/ });

    await useAppStore.getState().sendToLead({ ...ITEM, candidate: CANDIDATE });

    expect(entry()?.phase).toBe('failed');
    expect(entry()?.failure).toBe(SEND_TO_LEAD_COPY.notSaved);
    expect(await storedThreads()).toEqual([]);

    await useAppStore.getState().retrySendToLead({ key: KEY });

    expect(entry()?.phase).toBe('sent');
    expect(queue()).toHaveLength(1);
    expect(await storedThreads()).toEqual([THREAD]);
  });

  it('shows a held message as failed and Retry hands it to the queue retry', async () => {
    await seedLead();
    await useAppStore.getState().sendToLead({ ...ITEM, candidate: CANDIDATE });
    const retryQueuedMessage = vi.fn(async () => ({ isDelivered: true, failure: null }));
    useAppStore.setState((state) => ({
      retryQueuedMessage,
      agentQueue: {
        [FIXTURE_ROOT]: queue().map((turn) => ({
          ...turn,
          hold: { reason: 'The agent did not start. Your message is safe here.' },
        })),
      },
      sentToLead: state.sentToLead,
    }));
    expect(statusNow()).toBe('failed');

    await useAppStore.getState().retrySendToLead({ key: KEY });

    expect(retryQueuedMessage).toHaveBeenCalledWith({
      sessionId: FIXTURE_SESSION,
      agentId: FIXTURE_ROOT,
      itemId: entry()?.messageId,
    });
  });

  it('sends to a busy Lead anyway: the message waits in its queue as Not read yet', async () => {
    await seedLead({ phase: 'waiting' });

    await useAppStore.getState().sendToLead({ ...ITEM, candidate: CANDIDATE });

    expect(entry()?.phase).toBe('sent');
    expect(queue()).toHaveLength(1);
    expect(statusNow()).toBe('notRead');
  });

  it('drops a late answer for a send the user already replaced', async () => {
    await seedLead();
    const first = useAppStore.getState().sendToLead({ ...ITEM, candidate: CANDIDATE });
    const second = useAppStore
      .getState()
      .sendToLead({ ...ITEM, note: 'second', candidate: CANDIDATE });
    await Promise.all([first, second]);

    expect(entry()?.note).toBe('second');
    expect(entry()?.phase).toBe('sent');
  });
});
