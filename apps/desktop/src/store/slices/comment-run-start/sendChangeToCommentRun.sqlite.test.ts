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
import { insertAgent } from '@goodboy/db';
import {
  brandId,
  type Agent,
  type AgentId,
  type AgentStatus,
  type SessionId,
} from '@goodboy/types';
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
const LAYOUT_THREAD = 'PRRT_harborline_ledger_layout';
const FILTERS_THREAD = 'PRRT_harborline_ledger_filters';
const QUOTE =
  'A GitHub comment from mira-s on src/routes/ledger/LedgerPage.tsx:24:\n> Keep the export button in the page.';

let useAppStore: StoryStore;

const settleResolveSourceChange = vi.fn(async () => undefined);

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  settleResolveSourceChange.mockClear();
  useAppStore.setState({ settleResolveSourceChange });
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
  readonly status?: AgentStatus;
};

const seedLead = async ({ id, ordinal, status = 'running' }: LeadParams): Promise<Agent> => {
  const lead = await insertAgent(storySqlite(), {
    id: brandId<AgentId>({ value: id }),
    sessionId: SESSION,
    ordinal,
    name: 'Move the ledger header into AppLayout',
    status,
    kind: 'auto',
    sourceKind: 'comment_run',
    sourceThreadIds: [LAYOUT_THREAD, FILTERS_THREAD],
  });
  useAppStore.setState((state) => ({
    sessionPhaseRuns: {
      ...state.sessionPhaseRuns,
      [SESSION]: [...(state.sessionPhaseRuns[SESSION] ?? []), lead],
    },
  }));
  return lead;
};

const queueOf = (id: AgentId) => useAppStore.getState().agentQueue[id] ?? [];

const send = (agentId: AgentId) =>
  useAppStore.getState().sendChangeToCommentRun({
    sessionId: SESSION,
    agentId,
    threadId: LAYOUT_THREAD,
    quote: QUOTE,
  });

describe('Send the new text to the run', () => {
  it('queues one message with the new text, then settles only that comment', async () => {
    const lead = await seedLead({ id: 'lead-header', ordinal: 0 });

    await send(lead.id);

    expect(queueOf(lead.id)).toHaveLength(1);
    expect(queueOf(lead.id)[0]?.content).toContain(COMMENT_RUN_COPY.changedMessage);
    expect(queueOf(lead.id)[0]?.content).toContain('> Keep the export button in the page.');
    expect(settleResolveSourceChange).toHaveBeenCalledTimes(1);
    expect(settleResolveSourceChange).toHaveBeenCalledWith({
      sessionId: SESSION,
      threadId: LAYOUT_THREAD,
      keepDraft: false,
    });
  });

  it('refuses a run that stopped before the click, with nothing queued or settled', async () => {
    const lead = await seedLead({ id: 'lead-header', ordinal: 0, status: 'stopped' });

    await expect(send(lead.id)).rejects.toThrow(COMMENT_RUN_COPY.runEnded);
    expect(queueOf(lead.id)).toHaveLength(0);
    expect(settleResolveSourceChange).not.toHaveBeenCalled();
  });

  it('keeps the change when the message cannot be saved', async () => {
    const lead = await seedLead({ id: 'lead-header', ordinal: 0 });
    injectDbFault({ match: /agent_queued_messages/ });

    await expect(send(lead.id)).rejects.toThrow(COMMENT_RUN_COPY.changeNotSaved);
    expect(queueOf(lead.id)).toHaveLength(0);
    expect(settleResolveSourceChange).not.toHaveBeenCalled();
  });
});
