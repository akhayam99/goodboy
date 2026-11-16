// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type AgentId } from '@goodboy/types';
import { aProject, anAgent } from '@goodboy/types/testing';
import { aDelegation, aView, FIXTURE_ROOT } from '../auto/testing/autoViewFixtures';
import { placedAgentsOf } from './placedAgentsOf';
import { aMountView } from './testing/aMountView';

const PAYMENTS = aProject({ name: 'payments-api' });
const LEDGER = aProject({ name: 'ledger-core' });
const API = aMountView({
  key: 'payments-api',
  sessionId: brandId({ value: 'session-harborline' }),
  projectId: PAYMENTS.id,
  projectName: 'payments-api',
  branch: 'fix/duplicate-credit',
});
const BOOKS = aMountView({
  key: 'ledger-core',
  sessionId: brandId({ value: 'session-harborline' }),
  projectId: LEDGER.id,
  projectName: 'ledger-core',
  branch: 'rec/2-backfill',
});
const CHILD = brandId<AgentId>({ value: 'agent-fixer' });

const lead = () => anAgent({ id: FIXTURE_ROOT, kind: 'auto' });
const child = () => anAgent({ id: CHILD, parentAgentId: FIXTURE_ROOT });
type ViewParams = {
  readonly mountId: string;
};

const viewWithChildOn = ({ mountId }: ViewParams) =>
  aView({
    delegations: [
      {
        ...aDelegation({ key: 'fixer', role: 'implementer', state: 'running' }),
        target: { mountId },
      },
    ],
  });

describe('placedAgentsOf', () => {
  it('places a Lead on its tree mount and a child on its delegation target', () => {
    const placed = placedAgentsOf({
      agents: [lead(), child()],
      autoViews: [viewWithChildOn({ mountId: BOOKS.id })],
      mounts: [API, BOOKS],
    });

    expect(placed.map((agent) => agent.mountId)).toEqual([API.id, BOOKS.id]);
  });

  it('places an agent with no mount on the only mount of the session', () => {
    const placed = placedAgentsOf({ agents: [anAgent({})], autoViews: [], mounts: [API] });

    expect(placed[0]?.mountId).toBe(API.id);
  });

  it('keeps a recorded mount and leaves an unknown target alone', () => {
    const recorded = anAgent({ mountId: BOOKS.id });
    const placed = placedAgentsOf({
      agents: [recorded, child()],
      autoViews: [viewWithChildOn({ mountId: 'mount-gone' })],
      mounts: [API, BOOKS],
    });

    expect(placed[0]).toBe(recorded);
    expect(placed[1]?.mountId).toBeUndefined();
  });

  it('places nothing when two mounts share the session and no tree names one', () => {
    const placed = placedAgentsOf({ agents: [anAgent({})], autoViews: [], mounts: [API, BOOKS] });

    expect(placed[0]?.mountId).toBeUndefined();
  });

  it('returns the same list when every agent has a mount', () => {
    const agents = [anAgent({ mountId: API.id })];

    expect(placedAgentsOf({ agents, autoViews: [], mounts: [API] })).toBe(agents);
  });
});
