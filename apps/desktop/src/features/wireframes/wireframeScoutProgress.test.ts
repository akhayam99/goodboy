import { describe, expect, it } from 'vitest';
import type { Agent, AgentId, IsoDateTime, SessionId } from '@goodboy/types';
import {
  hasLiveWireframeScout,
  wireframeScoutLine,
  wireframeScoutProgress,
} from './wireframeScoutProgress';
import { WIREFRAME_SCOUT_DEADLINE_REASON } from './wireframeScoutReports';

const SESSION_ID = 'session-1' as SessionId;
const CONTAINER_ID = 'container-1' as AgentId;
const AT = '2026-09-15T10:00:00.000Z' as IsoDateTime;

const container = { id: CONTAINER_ID, sessionId: SESSION_ID, ordinal: 0 } as Agent;

const child = (patch: Partial<Agent> & { readonly id: AgentId; readonly name: string }): Agent =>
  ({
    sessionId: SESSION_ID,
    parentAgentId: CONTAINER_ID,
    ordinal: 1,
    kind: 'scout',
    status: 'pending',
    createdAt: AT,
    ...patch,
  }) as Agent;

describe('wireframeScoutProgress', () => {
  it('reads a running scout, a finished one and a skipped one', () => {
    const agents = [
      container,
      child({ id: 'c1' as AgentId, name: 'screens and routes', ordinal: 1, status: 'running' }),
      child({
        id: 'c2' as AgentId,
        name: 'data and contracts',
        ordinal: 2,
        status: 'completed',
        startedAt: AT,
        completedAt: '2026-09-15T10:00:14.000Z' as IsoDateTime,
      }),
      child({
        id: 'c3' as AgentId,
        name: 'late one',
        ordinal: 3,
        status: 'skipped',
        outputSummary: WIREFRAME_SCOUT_DEADLINE_REASON,
      }),
    ];
    const rows = wireframeScoutProgress({
      container,
      agents,
      runningAgentIds: new Set(['c1' as AgentId]),
      verifications: { c2: { verified: 8, cited: 11 } },
    });
    expect(rows.map((row) => row.state)).toEqual(['running', 'done', 'skipped']);
    expect(rows[1]?.detail).toBe('14s');
    expect(rows[1]?.claims).toBe('8 of 11 claims verified');
    expect(rows[2]?.detail).toBe('deadline');
  });

  it('ignores agents that are not children of this container', () => {
    const rows = wireframeScoutProgress({
      container,
      agents: [
        container,
        child({ id: 'other' as AgentId, name: 'x', parentAgentId: 'elsewhere' as AgentId }),
      ],
      runningAgentIds: new Set(),
      verifications: {},
    });
    expect(rows).toEqual([]);
  });
});

describe('wireframeScoutLine', () => {
  it('reads as one calm line per child', () => {
    expect(
      wireframeScoutLine({
        scout: {
          agentId: 'c1' as AgentId,
          name: 'screens and routes',
          state: 'running',
          detail: null,
          claims: null,
        },
      }),
    ).toBe('screens and routes · running');
    expect(
      wireframeScoutLine({
        scout: {
          agentId: 'c2' as AgentId,
          name: 'screens and routes',
          state: 'done',
          detail: '14s',
          claims: null,
        },
      }),
    ).toBe('screens and routes · done · 14s');
    expect(
      wireframeScoutLine({
        scout: {
          agentId: 'c3' as AgentId,
          name: 'data and contracts',
          state: 'skipped',
          detail: 'deadline',
          claims: null,
        },
      }),
    ).toBe('data and contracts · skipped: deadline');
  });

  it('appends the verified claim count once it is known', () => {
    expect(
      wireframeScoutLine({
        scout: {
          agentId: 'c4' as AgentId,
          name: 'data and contracts',
          state: 'done',
          detail: '9s',
          claims: '8 of 11 claims verified',
        },
      }),
    ).toBe('data and contracts · done · 9s · 8 of 11 claims verified');
  });
});

describe('hasLiveWireframeScout', () => {
  it('is true while a scout is queued or running', () => {
    expect(
      hasLiveWireframeScout({
        scouts: [
          { agentId: 'c1' as AgentId, name: 'a', state: 'done', detail: null, claims: null },
          { agentId: 'c2' as AgentId, name: 'b', state: 'queued', detail: null, claims: null },
        ],
      }),
    ).toBe(true);
  });

  it('is false once every scout settled', () => {
    expect(
      hasLiveWireframeScout({
        scouts: [
          { agentId: 'c1' as AgentId, name: 'a', state: 'done', detail: null, claims: null },
          { agentId: 'c2' as AgentId, name: 'b', state: 'skipped', detail: null, claims: null },
        ],
      }),
    ).toBe(false);
  });
});
