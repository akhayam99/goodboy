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
import { getAgentById, insertAgent } from '@goodboy/db';
import { brandId, type Agent, type AgentId, type SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  injectDbFault,
  openStorySqlite,
  resetStoryStore,
  storySqlite,
  type StoryStore,
} from '../../storyHarness';
import { COMMENT_RUN_COPY } from '../../../features/resolve/commentRunCopy';

const SESSION = brandId<SessionId>({ value: 'session-ledger-core' });
const HEADER_NOTE = 'note:note-ledger-header';
const FILTERS_NOTE = 'note:note-ledger-filters';
const IMPORT_THREAD = 'PRRT_harborline_import_order';
const QUOTE =
  'A local note from You on src/routes/ledger/LedgerFilters.tsx:9:\n> Same for the filters bar.';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({ drainAgentQueue: vi.fn(async () => undefined) });
  const db = await openStorySqlite();
  const now = Date.now();
  await db.execute(
    'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    ['workspace-harborline', 'Harborline', 'harborline', now, now],
  );
  await db.execute(
    'INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [SESSION, 'workspace-harborline', 'Speed up the ledger pages', 'idle', now, now],
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

type LeadParams = {
  readonly id: string;
  readonly ordinal: number;
  readonly threadIds: ReadonlyArray<string>;
};

const seedLead = async ({ id, ordinal, threadIds }: LeadParams): Promise<Agent> => {
  const lead = await insertAgent(storySqlite(), {
    id: brandId<AgentId>({ value: id }),
    sessionId: SESSION,
    ordinal,
    name: 'Move the ledger header into AppLayout',
    status: 'running',
    kind: 'auto',
    sourceKind: 'comment_run',
    sourceThreadIds: threadIds,
  });
  useAppStore.setState((state) => ({
    sessionPhaseRuns: {
      ...state.sessionPhaseRuns,
      [SESSION]: [...(state.sessionPhaseRuns[SESSION] ?? []), lead],
    },
  }));
  return lead;
};

const storedThreadsOf = async (id: AgentId) =>
  (await getAgentById(storySqlite(), id))?.sourceThreadIds;

const shownThreadsOf = (id: AgentId) =>
  useAppStore.getState().sessionPhaseRuns[SESSION]?.find((agent) => agent.id === id)
    ?.sourceThreadIds;

const queueOf = (id: AgentId) => useAppStore.getState().agentQueue[id] ?? [];

describe('Send to Lead from a comment', () => {
  it('links the thread to the run and queues one message with the quote for the Lead', async () => {
    const lead = await seedLead({ id: 'lead-header', ordinal: 0, threadIds: [HEADER_NOTE] });

    await useAppStore.getState().addToCommentRun({
      sessionId: SESSION,
      agentId: lead.id,
      threadId: FILTERS_NOTE,
      quote: QUOTE,
    });

    expect(await storedThreadsOf(lead.id)).toEqual([HEADER_NOTE, FILTERS_NOTE]);
    expect(shownThreadsOf(lead.id)).toEqual([HEADER_NOTE, FILTERS_NOTE]);
    expect(queueOf(lead.id)).toHaveLength(1);
    expect(queueOf(lead.id)[0]?.content).toContain(COMMENT_RUN_COPY.addedMessage);
    expect(queueOf(lead.id)[0]?.content).toContain('> Same for the filters bar.');
  });

  it('refuses a thread that another run already holds, before any write', async () => {
    const header = await seedLead({ id: 'lead-header', ordinal: 0, threadIds: [HEADER_NOTE] });
    await seedLead({ id: 'lead-imports', ordinal: 1, threadIds: [IMPORT_THREAD] });

    await expect(
      useAppStore.getState().addToCommentRun({
        sessionId: SESSION,
        agentId: header.id,
        threadId: IMPORT_THREAD,
        quote: QUOTE,
      }),
    ).rejects.toThrow(COMMENT_RUN_COPY.inRun);

    expect(await storedThreadsOf(header.id)).toEqual([HEADER_NOTE]);
    expect(queueOf(header.id)).toHaveLength(0);
  });

  it('refuses a run that stopped after the menu opened, and leaves the thread open', async () => {
    const lead = await seedLead({ id: 'lead-header', ordinal: 0, threadIds: [HEADER_NOTE] });
    await storySqlite().execute("UPDATE agents SET status = 'stopped' WHERE id = ?", [lead.id]);

    await expect(
      useAppStore.getState().addToCommentRun({
        sessionId: SESSION,
        agentId: lead.id,
        threadId: FILTERS_NOTE,
        quote: QUOTE,
      }),
    ).rejects.toThrow(COMMENT_RUN_COPY.runEnded);

    expect(await storedThreadsOf(lead.id)).toEqual([HEADER_NOTE]);
    expect(shownThreadsOf(lead.id)).toEqual([HEADER_NOTE]);
    expect(queueOf(lead.id)).toHaveLength(0);
  });

  it('takes the link back when the message to the Lead cannot be saved', async () => {
    const lead = await seedLead({ id: 'lead-header', ordinal: 0, threadIds: [HEADER_NOTE] });
    injectDbFault({ match: /agent_queued_messages/ });

    await expect(
      useAppStore.getState().addToCommentRun({
        sessionId: SESSION,
        agentId: lead.id,
        threadId: FILTERS_NOTE,
        quote: QUOTE,
      }),
    ).rejects.toThrow(COMMENT_RUN_COPY.notSaved);

    expect(await storedThreadsOf(lead.id)).toEqual([HEADER_NOTE]);
    expect(shownThreadsOf(lead.id)).toEqual([HEADER_NOTE]);
    expect(queueOf(lead.id)).toHaveLength(0);
  });

  it('drains the queue after the add, so an idle Lead reads the comment now', async () => {
    const drain = vi.fn(async () => undefined);
    useAppStore.setState({ drainAgentQueue: drain });
    const lead = await seedLead({ id: 'lead-header', ordinal: 0, threadIds: [HEADER_NOTE] });

    await useAppStore.getState().addToCommentRun({
      sessionId: SESSION,
      agentId: lead.id,
      threadId: FILTERS_NOTE,
      quote: QUOTE,
    });

    expect(drain).toHaveBeenCalledWith({ sessionId: SESSION, agentId: lead.id });
  });

  it('frees the comment when its message is removed before the Lead reads it', async () => {
    const lead = await seedLead({ id: 'lead-header', ordinal: 0, threadIds: [HEADER_NOTE] });
    await useAppStore.getState().addToCommentRun({
      sessionId: SESSION,
      agentId: lead.id,
      threadId: FILTERS_NOTE,
      quote: QUOTE,
    });
    const [queued] = queueOf(lead.id);
    expect(queued?.sourceThreadId).toBe(FILTERS_NOTE);

    await useAppStore.getState().removeQueuedMessage({
      sessionId: SESSION,
      agentId: lead.id,
      itemId: queued?.id ?? '',
    });

    expect(queueOf(lead.id)).toHaveLength(0);
    expect(await storedThreadsOf(lead.id)).toEqual([HEADER_NOTE]);
    expect(shownThreadsOf(lead.id)).toEqual([HEADER_NOTE]);
  });

  it('can be tried again after a failure, and adds the thread once', async () => {
    const lead = await seedLead({ id: 'lead-header', ordinal: 0, threadIds: [HEADER_NOTE] });
    injectDbFault({ match: /agent_queued_messages/ });
    const add = () =>
      useAppStore.getState().addToCommentRun({
        sessionId: SESSION,
        agentId: lead.id,
        threadId: FILTERS_NOTE,
        quote: QUOTE,
      });

    await expect(add()).rejects.toThrow(COMMENT_RUN_COPY.notSaved);
    await add();

    expect(await storedThreadsOf(lead.id)).toEqual([HEADER_NOTE, FILTERS_NOTE]);
    expect(queueOf(lead.id)).toHaveLength(1);
  });
});
