// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { insertAgent } from '@goodboy/db';
import type { AgentId, SessionId, WorkspaceId } from '@goodboy/types';
import type { AppStore } from '../../store';
import { openStorySqlite, storySqlite } from '../../../test/sqliteDb';
import type { SetFn } from './types';

vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../test/sqliteDb')).sqliteDbLibModuleMock(),
);

import { loadPhaseRunsForSession } from './loadPhaseRunsForSession';

const SESSION_ID = 'ses-1' as SessionId;
const WORKSPACE_ID = 'workspace-harborline' as WorkspaceId;

const insertScout = (id: string) =>
  insertAgent(storySqlite(), {
    id: id as AgentId,
    sessionId: SESSION_ID,
    ordinal: 0,
    name: 'scout',
    status: 'pending',
    kind: 'scout',
    effort: 'high',
    modelOverride: 'claude-opus-5',
    providerOverride: 'anthropic',
  });

beforeEach(async () => {
  const db = await openStorySqlite();
  await db.execute(
    'INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES (?, ?, ?, 1, 1)',
    [WORKSPACE_ID, 'Harborline', 'harborline'],
  );
  await db.execute(
    'INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES (?, ?, ?, ?, 1, 1)',
    [SESSION_ID, WORKSPACE_ID, 'goal', 'idle'],
  );
});

const makeStore = (initial: Partial<AppStore>) => {
  let state = initial;
  const set: SetFn = (update) => {
    const patch = typeof update === 'function' ? update(state as AppStore) : update;
    state = { ...state, ...patch };
  };
  return { set, getState: () => state };
};

describe('loadPhaseRunsForSession', () => {
  it('preserves a spawned agent provider, model and effort after a refresh', async () => {
    await insertScout('agent-new');
    const { set, getState } = makeStore({ sessionPhaseRuns: {} });

    await loadPhaseRunsForSession(set)(SESSION_ID);

    expect(getState().sessionPhaseRuns?.[SESSION_ID]?.[0]).toMatchObject({
      providerOverride: 'anthropic',
      modelOverride: 'claude-opus-5',
      effort: 'high',
    });
  });

  it('seeds the agent override maps from the persisted rows', async () => {
    await insertScout('agent-new');
    const { set, getState } = makeStore({
      sessionPhaseRuns: {},
      agentModelOverride: {},
      agentProviderOverride: {},
      agentEffortOverride: {},
    });

    await loadPhaseRunsForSession(set)(SESSION_ID);

    expect(getState().agentModelOverride).toEqual({ 'agent-new': 'claude-opus-5' });
    expect(getState().agentProviderOverride).toEqual({ 'agent-new': 'anthropic' });
    expect(getState().agentEffortOverride).toEqual({ 'agent-new': 'high' });
  });

  it('keeps fresher in-memory overrides over the persisted rows', async () => {
    await insertScout('agent-new');
    const { set, getState } = makeStore({
      sessionPhaseRuns: {},
      agentModelOverride: { ['agent-new' as AgentId]: 'claude-sonnet-4-6' },
      agentProviderOverride: { ['agent-new' as AgentId]: 'cursor' },
      agentEffortOverride: { ['agent-new' as AgentId]: 'low' },
    });

    await loadPhaseRunsForSession(set)(SESSION_ID);

    expect(getState().agentModelOverride).toEqual({ 'agent-new': 'claude-sonnet-4-6' });
    expect(getState().agentProviderOverride).toEqual({ 'agent-new': 'cursor' });
    expect(getState().agentEffortOverride).toEqual({ 'agent-new': 'low' });
  });
});
