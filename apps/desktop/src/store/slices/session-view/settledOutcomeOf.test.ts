// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type Agent, type IsoDateTime, type SessionArtifact } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { settledOutcomeOf } from './settledOutcomeOf';

type AgentParams = {
  readonly kind: string;
  readonly status?: Agent['status'];
};

const agentOf = ({ kind, status = 'completed' }: AgentParams): Agent =>
  anAgent({
    kind,
    status,
    lastFinishedAt: brandId<IsoDateTime>({ value: '2026-10-07T09:00:00.000Z' }),
  });

type ArtifactParams = {
  readonly kind: SessionArtifact['kind'];
  readonly status?: SessionArtifact['status'];
};

const artifactOf = ({ kind, status = 'active' }: ArtifactParams): SessionArtifact =>
  JSON.parse(JSON.stringify({ kind, status, metadata: {} }));

const SCOUT = agentOf({ kind: 'scout' });
const IMPLEMENTER = agentOf({ kind: 'implementer' });

describe('settledOutcomeOf', () => {
  it('reads a finished read-only agent as answered, with or without a mount', () => {
    expect(settledOutcomeOf({ agents: [SCOUT], artifacts: [], isBranchless: true })).toBe(
      'answered',
    );
    expect(settledOutcomeOf({ agents: [SCOUT], artifacts: [], isBranchless: false })).toBe(
      'answered',
    );
  });

  it('names the artifact: a plan before a report, a wireframe as a report', () => {
    expect(
      settledOutcomeOf({
        agents: [SCOUT],
        artifacts: [artifactOf({ kind: 'report' }), artifactOf({ kind: 'plan' })],
        isBranchless: true,
      }),
    ).toBe('plan-ready');
    expect(
      settledOutcomeOf({
        agents: [SCOUT],
        artifacts: [artifactOf({ kind: 'wireframe', status: 'consumed' })],
        isBranchless: true,
      }),
    ).toBe('report-ready');
  });

  it('ignores a superseded or discarded artifact', () => {
    expect(
      settledOutcomeOf({
        agents: [SCOUT],
        artifacts: [
          artifactOf({ kind: 'plan', status: 'superseded' }),
          artifactOf({ kind: 'report', status: 'discarded' }),
        ],
        isBranchless: true,
      }),
    ).toBe('answered');
  });

  it('settles a writer only in a folder with no branch, where a pull request cannot come', () => {
    expect(settledOutcomeOf({ agents: [IMPLEMENTER], artifacts: [], isBranchless: true })).toBe(
      'finished',
    );
    expect(
      settledOutcomeOf({ agents: [IMPLEMENTER], artifacts: [], isBranchless: false }),
    ).toBeNull();
    expect(
      settledOutcomeOf({ agents: [SCOUT, IMPLEMENTER], artifacts: [], isBranchless: false }),
    ).toBeNull();
  });

  it.each(['pending', 'running', 'blocked', 'failed', 'stopped'] as const)(
    'waits while an agent is %s',
    (status) => {
      expect(
        settledOutcomeOf({
          agents: [SCOUT, agentOf({ kind: 'scout', status })],
          artifacts: [],
          isBranchless: true,
        }),
      ).toBeNull();
    },
  );

  it('says nothing for a session with no agent, or only a deleted one', () => {
    expect(settledOutcomeOf({ agents: [], artifacts: [], isBranchless: true })).toBeNull();
    expect(
      settledOutcomeOf({
        agents: [
          { ...SCOUT, deletedAt: brandId<IsoDateTime>({ value: '2026-10-07T10:00:00.000Z' }) },
        ],
        artifacts: [],
        isBranchless: true,
      }),
    ).toBeNull();
  });
});
