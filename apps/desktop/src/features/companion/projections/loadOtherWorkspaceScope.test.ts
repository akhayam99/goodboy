// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ trees: vi.fn(), sessions: vi.fn() }));

vi.mock('@goodboy/db', async () =>
  (await import('../../../store/storyHarness')).dbModuleMock({
    getWorkspaceValue: vi.fn().mockResolvedValue(null),
    listAgentsForSessions: vi.fn().mockResolvedValue(new Map()),
    listContextSlotsForSession: vi.fn().mockResolvedValue([]),
    listExternalTasksForWorkspace: vi.fn().mockResolvedValue([]),
    listOpenQuestionsForSessions: vi.fn().mockResolvedValue([]),
    listProjectsForWorkspace: vi.fn().mockResolvedValue([]),
    listSessionsForWorkspace: h.sessions,
    listAutoTreesOfSession: h.trees,
  }),
);
vi.mock('@goodboy/db/mount-pr-link', () => ({
  listWorkspacePullRequestLinks: vi.fn().mockResolvedValue([]),
}));
vi.mock('./scopeOfState', () => ({
  scopeOfState: ({ state }: { readonly state: { readonly autoTreeViews: object } }) => ({
    trees: state.autoTreeViews,
  }),
}));

import { aSession } from '@goodboy/types/testing';
import type { Database } from '@goodboy/db';
import { fixtureOf } from '../actions/testing/decideTestKit';
import { loadOtherWorkspaceScope } from './loadOtherWorkspaceScope';
import type { ScopeState } from './scopeOfState';

const session = aSession({ goal: 'Northwind work' });
const archived = aSession({ goal: 'Archived', workspaceId: session.workspaceId });

const BASE = {
  sessions: [],
  projects: [],
  workspaceValues: {},
  autoTreeViews: { stale: [] },
};

const load = () =>
  loadOtherWorkspaceScope({
    db: fixtureOf<Database>({ value: {} }),
    workspace: { id: session.workspaceId, name: 'Northwind' },
    base: fixtureOf<ScopeState>({ value: BASE }),
  });

describe('loadOtherWorkspaceScope trees', () => {
  beforeEach(() => {
    h.trees.mockReset();
    h.trees.mockResolvedValue([]);
    h.sessions.mockResolvedValue([session, archived]);
  });

  it('reads the auto trees of every live session on each load and drops cached ones', async () => {
    const one = await load();
    await load();

    expect(Object.keys(one.trees)).toEqual([session.id, archived.id]);
    expect(h.trees).toHaveBeenCalledTimes(4);
    expect(Object.keys(one.trees)).not.toContain('stale');
  });
});
