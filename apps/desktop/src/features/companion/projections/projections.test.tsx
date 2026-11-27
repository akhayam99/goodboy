// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { aSession, aWorkspace, anAgent, aWorkflowRun } from '@goodboy/types/testing';
import {
  brandId,
  type ChatId,
  type ChatMessageId,
  type ChatSummary,
  type ProviderRunId,
  type SessionExternalTask,
} from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import {
  at,
  harborline,
  mergedGithub,
  openQuestionFor,
  paymentsApi,
  seedColumn,
  sessionOf,
} from '../../workspace/testing/sessionColumn';
import type { InboxRecord } from '../../inbox/types';
import { projectionFieldsOf, type ProjectionDraft } from './projectionFieldsOf';
import { projectionMetaOf } from './projectionMetaOf';
import { scopeOfState } from './scopeOfState';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const NOW = Date.parse('2026-10-05T09:05:00.000Z');

const northwind = aWorkspace({ name: 'Northwind', slug: 'northwind' });

const asking = sessionOf({ goal: 'Retry window for the webhook' });

const building = sessionOf({
  goal: 'Cascade the ledger rounding',
  updatedAt: '2026-10-04T09:00:00.000Z',
});

const archived = sessionOf({ goal: 'Archived cleanup' });

const inNorthwind = aSession({
  workspaceId: northwind.id,
  goal: 'Question in Northwind',
  state: { kind: 'idle', lastActivityAt: at('2026-10-01T09:00:00.000Z') },
  createdAt: at('2026-09-01T09:00:00.000Z'),
  updatedAt: at('2026-10-01T09:00:00.000Z'),
});

const run = aWorkflowRun({
  title: 'Ship the retry window',
  spendLimitUsd: 5,
});

const worker = anAgent({
  sessionId: building.id,
  workflowRunId: run.id,
  name: 'Builder',
  status: 'running',
});

const linearTask: SessionExternalTask = {
  sessionId: asking.id,
  provider: 'linear',
  externalId: 'lin-412',
  identifier: 'HBL-412',
  url: 'https://linear.app/harborline/issue/HBL-412',
  title: 'Retry window for the webhook',
  createdAt: at('2026-10-01T09:00:00.000Z'),
};

const linearRecord: InboxRecord = {
  key: 'linear:lin-412',
  provider: 'linear',
  kind: 'issue',
  identifier: 'HBL-412',
  title: 'Retry window for the webhook',
  state: 'active',
  stateLabel: 'In Progress',
  updatedAt: '2026-10-04T09:00:00.000Z',
  url: 'https://linear.app/harborline/issue/HBL-412',
  context: 'Harborline',
  payload: {
    provider: 'linear',
    kind: 'issue',
    sessionId: asking.id,
    issue: {
      id: 'lin-412',
      identifier: 'HBL-412',
      title: 'Retry window for the webhook',
      description: 'Back off the webhook retries so payments-api is not flooded.',
      url: 'https://linear.app/harborline/issue/HBL-412',
      state: { name: 'In Progress', type: 'started' },
      team: { key: 'HBL' },
      assignee: { name: 'Ada Northwind' },
      updatedAt: '2026-10-04T09:00:00.000Z',
    },
  },
};

type ChatIdParams = {
  readonly value: string;
};

const chatIdOf = ({ value }: ChatIdParams): ChatId => brandId<ChatId>({ value });

type ChatOverrides = Partial<Pick<ChatSummary, 'id' | 'title' | 'lastActivityAt' | 'archivedAt'>>;

const chatOf = ({
  id = chatIdOf({ value: 'chat-ledger' }),
  title = 'Ledger rounding',
  lastActivityAt = at('2026-10-05T09:00:00.000Z'),
  archivedAt = null,
}: ChatOverrides): ChatSummary => ({
  id,
  workspaceId: harborline.id,
  title,
  provider: 'anthropic',
  model: 'claude-opus-5',
  effort: null,
  pinnedAt: null,
  archivedAt,
  lastActivityAt,
  createdAt: at('2026-10-04T09:00:00.000Z'),
  updatedAt: lastActivityAt,
  preview: 'Round at the edge of the ledger.',
  modelsUsed: [],
  messageCount: 4,
});

const seed = (): void => {
  seedColumn({
    store: useAppStore,
    sessions: [asking, { ...building, workflowRuns: [run] }],
    archived: [archived],
    questions: [asking],
    mounts: [[asking, paymentsApi]],
  });
  useAppStore.setState((state) => ({
    starredRecords: { [harborline.id]: { 'linear:lin-412': linearRecord } },
    sessionSlots: {
      [asking.id]: [
        {
          key: 'last_output_summary',
          value: 'The retry window now backs off in three steps.',
          enabled: true,
        },
      ],
    },
    workspaces: [harborline, northwind],
    sessionPhaseRuns: { [building.id]: [worker] },
    sessionExternalTasks: { [asking.id]: [linearTask] },
    sessionGithub: { [asking.id]: mergedGithub() },
    sessionOpenQuestions: {
      ...state.sessionOpenQuestions,
      [inNorthwind.id]: [openQuestionFor({ sessionId: inNorthwind.id })],
    },
  }));
};

const draftsOf = (): ReadonlyArray<ProjectionDraft> => {
  const state = useAppStore.getState();
  const current = scopeOfState({
    workspace: harborline,
    state,
    sessions: state.sessions,
    isFullyLoaded: true,
  });
  const other = scopeOfState({
    workspace: northwind,
    state: { ...state, sessionProjectMounts: {}, sessionGithub: {}, sessionExternalTasks: {} },
    sessions: [inNorthwind],
    isFullyLoaded: false,
  });
  return projectionFieldsOf({
    scopes: [current, other],
    workspaces: [harborline, northwind],
    detailWorkspaceId: harborline.id,
    chips: {
      spendToday: '$4.18',
      limits: [{ providerLabel: 'Claude', leftText: '62% left', tone: 'neutral' }],
    },
    now: NOW,
  });
};

const draftOf = (key: string): ProjectionDraft => {
  const draft = draftsOf().find((candidate) => candidate.key === key);
  if (draft === undefined) {
    throw new Error(`no projection ${key}`);
  }
  return draft;
};

const fieldsOf = <T,>(key: string): T => JSON.parse(JSON.stringify(draftOf(key).fields));

const stamped = (draft: ProjectionDraft): object => ({
  ...projectionMetaOf({ epoch: 1, seq: 1, now: NOW }),
  ...draft.fields,
});

const fixtureOf = (draft: ProjectionDraft): string =>
  `${JSON.stringify(stamped(draft), null, 2)}\n`;

const FIXTURES = './fixtures';

describe('companion projections, one builder per contract projection', () => {
  it('lists the moves of every workspace with the desktop words', async () => {
    seed();

    const fields = fieldsOf<{
      moveCount: number;
      rows: ReadonlyArray<{
        goal: string;
        words: string;
        workspaceId: string;
        sessionRef: string | null;
      }>;
    }>('needsYou');

    expect(fields.moveCount).toBe(2);
    expect(fields.rows.map((row) => row.words)).toEqual([
      'Which retry window should the webhook use?',
      'Which retry window should the webhook use?',
    ]);
    expect(new Set(fields.rows.map((row) => row.workspaceId))).toEqual(
      new Set([harborline.id, northwind.id]),
    );
    expect(fields.rows.find((row) => row.goal === asking.goal)?.sessionRef).toBe('HBL-412');
    await expect(fixtureOf(draftOf('needsYou'))).toMatchFileSnapshot(`${FIXTURES}/needsYou.json`);
  });

  it('puts a decision on a question row that names the question and its version', () => {
    seed();

    const fields = fieldsOf<{
      rows: ReadonlyArray<{ decision: { kind: string; version: string } | null }>;
    }>('needsYou');

    expect(fields.rows[0]?.decision?.kind).toBe('question');
    expect(fields.rows[0]?.decision?.version).toBe('2026-10-05T09:00:00.000Z');
  });

  it('groups sessions in lanes and leaves the archived one out', async () => {
    seed();

    const fields = fieldsOf<{
      lanes: ReadonlyArray<{ stage: string; count: number; rows: ReadonlyArray<{ goal: string }> }>;
    }>(`sessions:${harborline.id}`);

    const goals = fields.lanes.flatMap((lane) => lane.rows.map((row) => row.goal));
    expect(goals).toContain(asking.goal);
    expect(goals).not.toContain(archived.goal);
    expect(fields.lanes.map((lane) => lane.stage)).toEqual([
      'attention',
      'running',
      'review',
      'building',
      'done',
    ]);
    await expect(fixtureOf(draftOf(`sessions:${harborline.id}`))).toMatchFileSnapshot(
      `${FIXTURES}/sessions.json`,
    );
  });

  it('builds the session detail with its projects and the question it waits on', async () => {
    seed();

    const key = `session:${harborline.id}:${asking.id}`;
    const fields = fieldsOf<{
      needsYou: ReadonlyArray<unknown>;
      projects: ReadonlyArray<{ name: string }>;
      summary: string | null;
    }>(key);

    expect(fields.summary).toBe('The retry window now backs off in three steps.');
    expect(fields.needsYou).toHaveLength(1);
    expect(fields.projects.map((project) => project.name)).toEqual(['payments-api']);
    await expect(fixtureOf(draftOf(key))).toMatchFileSnapshot(`${FIXTURES}/session.json`);
  });

  it('builds runs with the limit and the running agent', async () => {
    seed();

    const key = `runs:${harborline.id}:${building.id}`;
    const fields = fieldsOf<{
      runs: ReadonlyArray<{
        state: string;
        limit: { text: string } | null;
        agents: ReadonlyArray<unknown>;
      }>;
    }>(key);

    expect(fields.runs[0]?.state).toBe('running');
    expect(fields.runs[0]?.limit?.text).toBe('$5.00');
    expect(fields.runs[0]?.agents).toHaveLength(1);
    await expect(fixtureOf(draftOf(key))).toMatchFileSnapshot(`${FIXTURES}/runs.json`);
  });

  it('builds the pull request of a session that has one', async () => {
    seed();

    const key = `pullRequest:${harborline.id}:${asking.id}`;
    const fields = fieldsOf<{
      number: number;
      phase: string;
      mergeActionId: string | null;
    }>(key);

    expect(fields.number).toBe(304);
    expect(fields.phase).toBe('merged');
    expect(fields.mergeActionId).toBeNull();
    await expect(fixtureOf(draftOf(key))).toMatchFileSnapshot(`${FIXTURES}/pullRequest.json`);
  });

  it('builds the tasks of the workspace', async () => {
    seed();

    const key = `tasks:${harborline.id}`;
    const fields = fieldsOf<{ count: number; rows: ReadonlyArray<{ key: string }> }>(key);

    expect(fields.count).toBe(1);
    expect(fields.rows[0]?.key).toBe('HBL-412');
    expect(fields.rows[0]).toMatchObject({
      description: 'Back off the webhook retries so payments-api is not flooded.',
      assignee: 'Ada Northwind',
      stateLabel: 'In Progress',
    });
    await expect(fixtureOf(draftOf(key))).toMatchFileSnapshot(`${FIXTURES}/tasks.json`);
  });

  it('builds the chats of the workspace with the actions that send and create', async () => {
    seed();
    useAppStore.setState({
      chatsByWorkspace: {
        [harborline.id]: [
          chatOf({}),
          chatOf({
            id: chatIdOf({ value: 'chat-notify' }),
            title: 'Notify relay retries',
            lastActivityAt: at('2026-10-05T08:00:00.000Z'),
          }),
          chatOf({
            id: chatIdOf({ value: 'chat-old' }),
            archivedAt: at('2026-10-01T09:00:00.000Z'),
          }),
        ],
      },
      chatStreams: {
        [chatIdOf({ value: 'chat-notify' })]: {
          runId: brandId<ProviderRunId>({ value: 'run-1' }),
          messageId: brandId<ChatMessageId>({ value: 'message-1' }),
          isStopping: false,
        },
      },
    });

    const key = `chats:${harborline.id}`;
    const fields = fieldsOf<{
      chats: ReadonlyArray<{ id: string; isBusy: boolean; sendActionId: string }>;
      createActionId: string;
    }>(key);

    expect(fields.chats.map((chat) => chat.id)).toEqual(['chat-ledger', 'chat-notify']);
    expect(fields.chats.map((chat) => chat.isBusy)).toEqual([false, true]);
    expect(fields.chats[0]?.sendActionId).toBe('act:sendChatMessage:chat-ledger:0');
    expect(fields.createActionId).toBe(`act:createChat:${harborline.id}:0`);
    await expect(fixtureOf(draftOf(key))).toMatchFileSnapshot(`${FIXTURES}/chats.json`);
  });

  it('never carries an absolute path, an archived session, a token or a mount path', () => {
    seed();
    useAppStore.setState({ sessionPhaseRuns: { [building.id]: [worker] } });

    const wire = JSON.stringify(draftsOf().map((draft) => draft.fields));
    const values = [...wire.matchAll(/"([^"\\]*)"/g)].map((match) => match[1] ?? '');

    expect(values.filter((value) => value.startsWith('/'))).toEqual([]);
    expect(wire).not.toContain('worktreePath');
    expect(wire).not.toContain('repoRoot');
    expect(wire).not.toContain('/tmp/');
    expect(wire).not.toContain(archived.goal);
    expect(wire.toLowerCase()).not.toContain('token');
    expect(wire).not.toContain('archivedAt');
  });
});
