import { describe, expect, it } from 'vitest';
import { brandId, type AgentId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { aView, FIXTURE_ROOT } from './testing/autoViewFixtures';
import { liveAutoViewsOf } from './liveAutoViewsOf';

const SECOND_ROOT = brandId<AgentId>({ value: 'agent-auto-second' });

const secondView = () => {
  const view = aView({ phase: 'waiting' });
  return { ...view, tree: { ...view.tree, rootAgentId: SECOND_ROOT } };
};

describe('liveAutoViewsOf', () => {
  it('keeps every tree whose root agent is in the session, and the same list when none is gone', () => {
    const views = [aView({ phase: 'waiting' }), secondView()];
    const agents = [anAgent({ id: FIXTURE_ROOT }), anAgent({ id: SECOND_ROOT })];

    expect(liveAutoViewsOf({ views, agents })).toBe(views);
  });

  it('drops a tree whose root agent was deleted', () => {
    const kept = aView({ phase: 'waiting' });

    expect(
      liveAutoViewsOf({ views: [kept, secondView()], agents: [anAgent({ id: FIXTURE_ROOT })] }),
    ).toEqual([kept]);
  });

  it('drops a tree whose root agent was moved to another session', () => {
    expect(liveAutoViewsOf({ views: [aView({ phase: 'blocked' })], agents: [] })).toEqual([]);
  });
});
