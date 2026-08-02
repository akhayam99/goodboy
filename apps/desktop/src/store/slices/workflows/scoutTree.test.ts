import { describe, expect, it } from 'vitest';
import type { Agent, AgentId, SessionId } from '@goodboy/types';
import { SCOUT_DEPTH_CAP, SCOUT_MAX_CHILDREN, scoutDepth } from './scoutTree';

const SID = 'sess-1' as SessionId;

function node(id: string, parentId?: string): Agent {
  return {
    id: id as AgentId,
    sessionId: SID,
    ordinal: 0,
    name: id,
    status: 'pending',
    kind: 'scout',
    ...(parentId !== undefined && { parentAgentId: parentId as AgentId }),
  };
}

describe('scoutDepth', () => {
  const root = node('root');
  const child = node('child', 'root');
  const grandchild = node('grandchild', 'child');
  const runs = [root, child, grandchild];

  it('reports 0 for a root scout with no parent', () => {
    expect(scoutDepth(runs, 'root' as AgentId)).toBe(0);
  });

  it('counts one edge per ancestor', () => {
    expect(scoutDepth(runs, 'child' as AgentId)).toBe(1);
    expect(scoutDepth(runs, 'grandchild' as AgentId)).toBe(2);
  });

  it('returns 0 for an unknown id', () => {
    expect(scoutDepth(runs, 'missing' as AgentId)).toBe(0);
  });

  it('terminates on a parent cycle instead of looping forever', () => {
    const a = node('a', 'b');
    const b = node('b', 'a');
    expect(scoutDepth([a, b], 'a' as AgentId)).toBeLessThanOrEqual(2);
  });
});

describe('scout caps', () => {
  it('keeps the depth cap at the legible recursion limit', () => {
    expect(SCOUT_DEPTH_CAP).toBe(2);
  });

  it('bounds fan-out width so one split cannot fork-bomb', () => {
    expect(SCOUT_MAX_CHILDREN).toBe(4);
  });
});
