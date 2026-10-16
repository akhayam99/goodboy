import { describe, expect, it } from 'vitest';
import { brandId, type AgentId } from '@goodboy/types';
import type { AutoTreeView } from '../../store/slices/auto-view/state';
import { autoMembershipOf } from './autoMembershipOf';
import { FIXTURE_ROOT, aDelegation, aTree } from './testing/autoViewFixtures';

const OTHER = brandId<AgentId>({ value: 'agent-other' });
const CHILD = brandId<AgentId>({ value: 'agent-scout' });

type ViewParams = {
  readonly isAdopted?: boolean;
};

const viewWithScout = ({ isAdopted = false }: ViewParams = {}): AutoTreeView => ({
  tree: aTree(),
  delegations: [{ ...aDelegation({ key: 'scout', role: 'scout', state: 'running' }), isAdopted }],
  artifacts: [],
  budget: null,
  pendingRefusal: null,
});

describe('which Auto tree an agent belongs to', () => {
  it('is not a member of anything when no tree names it', () => {
    expect(autoMembershipOf({ views: [viewWithScout()], agentId: OTHER })).toEqual({
      isMember: false,
      adoption: null,
    });
    expect(autoMembershipOf({ views: [], agentId: OTHER }).isMember).toBe(false);
  });

  it('counts the Auto agent of a tree as a member', () => {
    expect(autoMembershipOf({ views: [viewWithScout()], agentId: FIXTURE_ROOT })).toEqual({
      isMember: true,
      adoption: null,
    });
  });

  it('counts an agent Auto started as a member, but not as moved', () => {
    expect(autoMembershipOf({ views: [viewWithScout()], agentId: CHILD })).toEqual({
      isMember: true,
      adoption: null,
    });
  });

  it('knows an agent that was moved to Auto, and which Auto holds it', () => {
    const membership = autoMembershipOf({
      views: [viewWithScout({ isAdopted: true })],
      agentId: CHILD,
    });

    expect(membership.isMember).toBe(true);
    expect(membership.adoption?.autoAgentId).toBe(FIXTURE_ROOT);
    expect(membership.adoption?.delegation.childAgentId).toBe(CHILD);
  });
});
