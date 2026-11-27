// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ views: vi.fn(), sessions: vi.fn() }));

vi.mock('../../../store/slices/auto-view/readAutoTreeViews', () => ({
  readAutoTreeViews: h.views,
}));
vi.mock('@goodboy/db', () => ({
  getWorkspaceValue: vi.fn().mockResolvedValue(null),
  listAgentsForSessions: vi.fn().mockResolvedValue(new Map()),
  listContextSlotsForSession: vi.fn().mockResolvedValue([]),
  listExternalTasksForWorkspace: vi.fn().mockResolvedValue([]),
  listOpenQuestionsForSessions: vi.fn().mockResolvedValue([]),
  listProjectsForWorkspace: vi.fn().mockResolvedValue([]),
  listSessionsForWorkspace: h.sessions,
}));
vi.mock('./scopeOfState', () => ({
  scopeOfState: ({ state }: { readonly state: { readonly autoTreeViews: object } }) => ({
    trees: state.autoTreeViews,
  }),
}));
vi.mock('@goodboy/db/mount-pr-link', () => ({
  listWorkspacePullRequestLinks: vi.fn().mockResolvedValue([]),
}));

import { aSession } from '@goodboy/types/testing';
import type { Database } from '@goodboy/db';
import { aView } from '../../auto/testing/autoViewFixtures';
import { fixtureOf } from '../actions/testing/decideTestKit';
import { loadOtherWorkspaceScope } from './loadOtherWorkspaceScope';
import type { ScopeState } from './scopeOfState';

const session = aSession({ goal: 'Northwind work' });

const BASE = {
  sessions: [],
  projects: [],
  workspaceValues: {},
  sessionOpenQuestions: {},
  sessionPhaseRuns: {},
  sessionExternalTasks: {},
  sessionGithub: {},
  sessionSlots: {},
  sessionProjectMounts: {},
  sessionResolveThreads: {},
  autoTreeViews: {},
  chatsByWorkspace: {},
  chatStreams: {},
  starredRecords: {},
  sessionTelemetry: {},
  phaseTemplates: {},
  workspaceOverrides: {},
  mergeTrain: null,
};

const load = () =>
  loadOtherWorkspaceScope({
    db: fixtureOf<Database>({ value: {} }),
    workspace: { id: session.workspaceId, name: 'Northwind' },
    base: fixtureOf<ScopeState>({ value: BASE }),
  });

describe('loadOtherWorkspaceScope trees', () => {
  beforeEach(() => {
    h.sessions.mockResolvedValue([session]);
  });

  it('reads the auto tree views of each live session and refreshes them on every load', async () => {
    h.views
      .mockResolvedValueOnce([aView({ phase: 'waiting' })])
      .mockResolvedValueOnce([aView({ phase: 'answering' })]);

    const one = await load();
    const two = await load();

    expect(one.trees[session.id]?.[0]?.tree.phase).toBe('waiting');
    expect(two.trees[session.id]?.[0]?.tree.phase).toBe('answering');
  });
});
