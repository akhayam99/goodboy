// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { AUTO_BLOCK_TEXT } from '@goodboy/core/auto';
import type { AutoPhase } from '@goodboy/db';
import { aSession, anAgent } from '@goodboy/types/testing';
import { brandId, type AgentId } from '@goodboy/types';
import { autoRowFacts } from './autoRowFacts';
import { aDelegation, aPlanRow, aView } from './testing/autoViewFixtures';
import { withoutAutoChildren } from './withoutAutoChildren';

const factsOf = (phase: AutoPhase) => autoRowFacts({ view: aView({ phase }) });

describe('autoRowFacts', () => {
  it('leaves an answering tree to the agent row', () => {
    expect(factsOf('answering')).toBeNull();
  });

  it('says Idle when the work rests and Done for a tree the user closed', () => {
    expect(factsOf('done')).toEqual({ phase: 'done', word: 'Idle', short: 'Idle' });
    expect(factsOf('finished')).toEqual({
      phase: 'closed',
      word: 'Done',
      short: 'Done',
    });
  });

  it('names the roles it waits for, each once, and drops the settled ones', () => {
    const facts = autoRowFacts({
      view: aView({
        phase: 'waiting',
        delegations: [
          aDelegation({ key: 'planner', role: 'planner', state: 'settled', outcome: 'completed' }),
          aDelegation({ key: 'impl', role: 'implementer', state: 'running' }),
          aDelegation({ key: 'test', role: 'tester', state: 'accepted' }),
          aDelegation({ key: 'test-2', role: 'tester', state: 'running' }),
        ],
      }),
    });

    expect(facts).toEqual({
      phase: 'running',
      word: 'Waiting for Implementer and Tester',
      short: 'Waiting',
    });
  });

  it('says Needs you while a plan waits for it and nothing revises it', () => {
    const asked = (artifacts: ReturnType<typeof aPlanRow>[]) =>
      autoRowFacts({ view: aView({ phase: 'waiting', artifacts }) });

    expect(asked([aPlanRow()])).toEqual({
      phase: 'waiting',
      word: 'Needs you',
      short: 'Needs you',
    });
    expect(asked([aPlanRow({ openRevise: 'delegation-revise' })])?.word).toBe('Waiting');
    expect(asked([aPlanRow({ approvalState: 'approved', approvedRevision: 1 })])?.word).toBe(
      'Waiting',
    );
  });

  it.each([
    ['the budget', AUTO_BLOCK_TEXT.budget],
    ['the wall clock', AUTO_BLOCK_TEXT.limit_wall_clock],
  ])('says Paused, waiting on you, for a tree blocked by %s', (_name, blockedReason) => {
    const view = aView({ phase: 'blocked' });

    expect(autoRowFacts({ view: { ...view, tree: { ...view.tree, blockedReason } } })).toEqual({
      phase: 'waiting',
      word: 'Paused',
      short: 'Paused',
    });
  });

  it('says Paused for a spent limit in every live phase, as the glance does', () => {
    for (const phase of ['waiting', 'deciding', 'delegating', 'merging'] as const) {
      expect(autoRowFacts({ view: aView({ phase, capUsd: 1, spentUsd: 1 }) }), phase).toEqual({
        phase: 'waiting',
        word: 'Paused',
        short: 'Paused',
      });
    }
  });

  it('keeps the plan that waits ahead of a spent limit', () => {
    const view = aView({ phase: 'waiting', capUsd: 1, spentUsd: 1, artifacts: [aPlanRow()] });

    expect(autoRowFacts({ view })?.word).toBe('Needs you');
  });

  it('says what the tree does in every other phase', () => {
    expect(factsOf('deciding')).toEqual({
      phase: 'running',
      word: 'Deciding what to do',
      short: 'Deciding',
    });
    expect(factsOf('delegating')?.short).toBe('Starting');
    expect(factsOf('merging')).toEqual({
      phase: 'running',
      word: 'Reading the results',
      short: 'Reading',
    });
    expect(factsOf('blocked')).toEqual({ phase: 'failed', word: 'Failed', short: 'Failed' });
    expect(factsOf('stopping')?.short).toBe('Stopping');
    expect(factsOf('stopped')).toEqual({
      phase: 'closed',
      word: 'Stopped by you',
      short: 'Stopped',
    });
  });
});

describe('withoutAutoChildren', () => {
  const session = aSession();
  const agentOf = (id: string) =>
    anAgent({ id: brandId<AgentId>({ value: id }), sessionId: session.id });
  const root = agentOf('agent-auto');
  const planner = agentOf('agent-planner');
  const source = agentOf('agent-source');
  const other = agentOf('agent-other');

  it('drops the children of a tree from the top level and keeps everything else', () => {
    const view = aView({
      phase: 'waiting',
      delegations: [aDelegation({ key: 'planner', role: 'planner', state: 'running' })],
    });

    expect(
      withoutAutoChildren({ agents: [root, planner, other], views: [view] }).map(
        (agent) => agent.id,
      ),
    ).toEqual(['agent-auto', 'agent-other']);
  });

  it('keeps an adopted agent, which is no child of the tree but its source', () => {
    const adopted = {
      ...aDelegation({ key: 'adopt', role: 'implementer', state: 'running' }),
      isAdopted: true,
      childAgentId: source.id,
    };

    expect(
      withoutAutoChildren({
        agents: [root, source],
        views: [aView({ phase: 'waiting', delegations: [adopted] })],
      }),
    ).toHaveLength(2);
  });

  it('returns the same list when there is no tree', () => {
    const agents = [root, other];

    expect(withoutAutoChildren({ agents, views: [] })).toBe(agents);
  });
});
