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
import type { AgentId, SessionExternalTask, WorkflowRunId } from '@goodboy/types';
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
  id: 'run-harborline' as WorkflowRunId,
  title: 'Ship the retry window',
  spendLimitUsd: 5,
});

const worker = anAgent({
  id: 'agent-harborline' as AgentId,
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

const seed = (): void => {
  seedColumn({
    store: useAppStore,
    sessions: [asking, { ...building, workflowRuns: [run] }],
    archived: [archived],
    questions: [asking],
    mounts: [[asking, paymentsApi]],
  });
  useAppStore.setState((state) => ({
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
    detailWorkspaceId: harborline.id,
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

const stamped = (draft: ProjectionDraft): object => ({
  ...projectionMetaOf({ epoch: 1, seq: 1, now: NOW }),
  ...draft.fields,
});

const FIXTURES = './fixtures';

describe('companion projections, one builder per contract projection', () => {
  it('lists the moves of every workspace with the desktop words', async () => {
    seed();

    const fields = draftOf('needsYou').fields as {
      moveCount: number;
      rows: ReadonlyArray<{
        goal: string;
        words: string;
        workspaceId: string;
        sessionRef: string | null;
      }>;
    };

    expect(fields.moveCount).toBe(2);
    expect(fields.rows.map((row) => row.words)).toEqual([
      'Which retry window should the webhook use?',
      'Which retry window should the webhook use?',
    ]);
    expect(new Set(fields.rows.map((row) => row.workspaceId))).toEqual(
      new Set([harborline.id, northwind.id]),
    );
    expect(fields.rows.find((row) => row.goal === asking.goal)?.sessionRef).toBe('HBL-412');
    await expect(JSON.stringify(stamped(draftOf('needsYou')), null, 2)).toMatchFileSnapshot(
      `${FIXTURES}/needsYou.json`,
    );
  });

  it('puts a decision on a question row that names the question and its version', () => {
    seed();

    const fields = draftOf('needsYou').fields as {
      rows: ReadonlyArray<{ decision: { kind: string; version: string } | null }>;
    };

    expect(fields.rows[0]?.decision?.kind).toBe('question');
    expect(fields.rows[0]?.decision?.version).toBe('2026-10-05T09:00:00.000Z');
  });

  it('groups sessions in lanes and leaves the archived one out', async () => {
    seed();

    const fields = draftOf(`sessions:${harborline.id}`).fields as {
      lanes: ReadonlyArray<{ stage: string; count: number; rows: ReadonlyArray<{ goal: string }> }>;
    };

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
    await expect(
      JSON.stringify(stamped(draftOf(`sessions:${harborline.id}`)), null, 2),
    ).toMatchFileSnapshot(`${FIXTURES}/sessions.json`);
  });

  it('builds the session detail with its projects and the question it waits on', async () => {
    seed();

    const key = `session:${harborline.id}:${asking.id}`;
    const fields = draftOf(key).fields as {
      needsYou: ReadonlyArray<unknown>;
      projects: ReadonlyArray<{ name: string }>;
    };

    expect(fields.needsYou).toHaveLength(1);
    expect(fields.projects.map((project) => project.name)).toEqual(['payments-api']);
    await expect(JSON.stringify(stamped(draftOf(key)), null, 2)).toMatchFileSnapshot(
      `${FIXTURES}/session.json`,
    );
  });

  it('builds runs with the limit and the running agent', async () => {
    seed();

    const key = `runs:${harborline.id}:${building.id}`;
    const fields = draftOf(key).fields as {
      runs: ReadonlyArray<{
        state: string;
        limit: { text: string } | null;
        agents: ReadonlyArray<unknown>;
      }>;
    };

    expect(fields.runs[0]?.state).toBe('running');
    expect(fields.runs[0]?.limit?.text).toBe('$5.00');
    expect(fields.runs[0]?.agents).toHaveLength(1);
    await expect(JSON.stringify(stamped(draftOf(key)), null, 2)).toMatchFileSnapshot(
      `${FIXTURES}/runs.json`,
    );
  });

  it('builds the pull request of a session that has one', async () => {
    seed();

    const key = `pullRequest:${harborline.id}:${asking.id}`;
    const fields = draftOf(key).fields as {
      number: number;
      phase: string;
      mergeActionId: string | null;
    };

    expect(fields.number).toBe(304);
    expect(fields.phase).toBe('merged');
    expect(fields.mergeActionId).toBeNull();
    await expect(JSON.stringify(stamped(draftOf(key)), null, 2)).toMatchFileSnapshot(
      `${FIXTURES}/pullRequest.json`,
    );
  });

  it('builds the tasks of the workspace', async () => {
    seed();

    const key = `tasks:${harborline.id}`;
    const fields = draftOf(key).fields as { count: number; rows: ReadonlyArray<{ key: string }> };

    expect(fields.count).toBe(1);
    expect(fields.rows[0]?.key).toBe('HBL-412');
    await expect(JSON.stringify(stamped(draftOf(key)), null, 2)).toMatchFileSnapshot(
      `${FIXTURES}/tasks.json`,
    );
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
