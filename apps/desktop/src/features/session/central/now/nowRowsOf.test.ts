// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Work } from '../../../live-state/workOf';
import { brandId, type AgentId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import {
  aDelegation,
  aView,
  FIXTURE_NOW,
  FIXTURE_ROOT,
} from '../../../auto/testing/autoViewFixtures';
import { liveGroupsOf } from './liveGroupsOf';
import { nowModelOf, NOW_SESSION, NOW_STARTED_AT } from './testing/nowModelOf';
import { NOW_LIMIT, nowRowsOf } from './nowRowsOf';

type WorkParams = {
  readonly agentId: string;
  readonly phrase: string;
};

const workOf = ({ agentId, phrase }: WorkParams): Work => ({
  runId: `run-${agentId}`,
  sessionId: 'session-hbl-412',
  agentId,
  mountId: 'mount-api',
  workflowRunId: null,
  place: { kind: 'project', name: 'payments-api' },
  phrase,
  startedAt: 1_000,
  quietMs: null,
});

const NOUNS = new Map([
  ['a1', 'Implementer'],
  ['a2', 'Tester'],
  ['a3', 'Reviewer'],
  ['a4', 'Debugger'],
]);

describe('nowRowsOf', () => {
  it('shows at most three agents with a live turn and counts the rest', () => {
    const work = ['a1', 'a2', 'a3', 'a4'].map((agentId) =>
      workOf({ agentId, phrase: `Editing ${agentId}.ts` }),
    );
    const model = nowRowsOf({ groups: [], work, writerWaits: [], nounById: NOUNS });
    expect(model.shown).toHaveLength(NOW_LIMIT);
    expect(model.moreCount).toBe(1);
    expect(model.shown[0]).toEqual({
      agentId: 'a1',
      depth: 0,
      who: 'Implementer',
      place: 'payments-api',
      phrase: 'Editing a1.ts',
      startedAt: 1_000,
    });
  });

  it('is empty when nothing runs', () => {
    const model = nowRowsOf({ groups: [], work: [], writerWaits: [], nounById: NOUNS });
    expect(model.shown).toEqual([]);
    expect(model.moreCount).toBe(0);
    expect(model.waits).toEqual([]);
  });

  it('turns an agent that waits for a file into a hot wait line, never a live row', () => {
    const work = [
      workOf({ agentId: 'a1', phrase: 'Editing state.ts' }),
      workOf({ agentId: 'a2', phrase: 'No tool call yet' }),
    ];
    const model = nowRowsOf({
      groups: [],
      work,
      writerWaits: [{ agentId: 'a2', path: 'src/retry/state.ts', blockedBy: 'a1', since: 500 }],
      nounById: NOUNS,
    });
    expect(model.shown.map((row) => row.agentId)).toEqual(['a1']);
    expect(model.waits).toEqual([
      {
        id: 'writer:a2',
        text: 'Tester waits on src/retry/state.ts, held by the Implementer',
        isHot: true,
        since: 500,
      },
    ]);
  });

  describe('a Lead that delegated to the same agent three times', () => {
    const fixerId = brandId<AgentId>({ value: 'agent-fixer' });
    const root = anAgent({
      id: FIXTURE_ROOT,
      sessionId: NOW_SESSION,
      kind: 'auto',
      name: 'Check the payout docs',
      status: 'running',
      startedAt: NOW_STARTED_AT,
    });
    const fixer = anAgent({
      id: fixerId,
      sessionId: NOW_SESSION,
      parentAgentId: FIXTURE_ROOT,
      name: 'Fixer',
      status: 'running',
    });
    const attempt = ({ key, slot }: { key: string; slot: number }) => ({
      ...aDelegation({ key, role: 'implementer', state: 'running' }),
      childAgentId: fixerId,
      slot,
    });
    const view = aView({
      phase: 'waiting',
      delegations: [
        attempt({ key: 'first', slot: 0 }),
        attempt({ key: 'retry-1', slot: 1 }),
        attempt({ key: 'retry-2', slot: 2 }),
      ],
    });
    const agents = [root, fixer];
    const groups = liveGroupsOf({
      model: nowModelOf({ agents, autoTrees: [view] }),
      agents,
      now: FIXTURE_NOW,
    });
    const work = [
      workOf({ agentId: 'agent-fixer', phrase: 'Editing retry.ts' }),
      workOf({ agentId: 'a2', phrase: 'Running tests' }),
      workOf({ agentId: 'a3', phrase: 'Reading docs' }),
      workOf({ agentId: 'a4', phrase: 'Checking types' }),
    ];
    const nounById = new Map([['agent-fixer', 'Implementer'], ...NOUNS]);

    it('lists the agent once and counts the rest from there', () => {
      const model = nowRowsOf({ groups, work, writerWaits: [], nounById });
      expect(model.rows.filter((row) => row.agentId === 'agent-fixer')).toHaveLength(1);
      expect(model.rows).toHaveLength(4);
      expect(model.shown).toHaveLength(NOW_LIMIT);
      expect(model.moreCount).toBe(1);
    });

    it('lists the agent once even when a group still holds it three times', () => {
      const [group] = groups;
      if (group?.kind !== 'auto') {
        throw new Error('expected an auto group');
      }
      const repeated = { ...group, children: [...group.children, ...group.children] };
      const model = nowRowsOf({ groups: [repeated], work, writerWaits: [], nounById });
      expect(model.rows.filter((row) => row.agentId === 'agent-fixer')).toHaveLength(1);
      expect(model.moreCount).toBe(1);
    });

    it('names the Lead wait on the agent once', () => {
      const model = nowRowsOf({
        groups,
        work: work.slice(0, 1),
        writerWaits: [],
        nounById,
      });
      expect(model.waits.filter((wait) => wait.id.startsWith('lead:'))).toHaveLength(1);
      expect(model.rows).toHaveLength(1);
    });
  });
});
