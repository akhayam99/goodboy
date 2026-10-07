// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import type {
  ArtifactComment,
  ImplementationCluster,
  IsoDateTime,
  ProviderRunId,
  SessionId,
} from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import { useAppStore } from '../../../store';
import {
  PLAN_FIXTURE_ID,
  PLAN_FIXTURE_PLANNER,
  PLAN_FIXTURE_SESSION,
  aPlan,
  aStoredPlan,
} from '../../../test/planFixtures';
import { resolveActions } from '../resolveActions';
import type { ArtifactPorts } from '../types';
import { ARTIFACT_KIND } from './artifact';

const AT = '2026-10-05T10:00:00.000Z' as IsoDateTime;

const aDraft = (id: string): ArtifactComment => ({
  id,
  sessionId: PLAN_FIXTURE_SESSION as SessionId,
  artifactId: PLAN_FIXTURE_ID,
  revision: 1,
  anchor: { kind: 'quote', order: 0, text: 'backoff', blockText: 'Add backoff' },
  body: 'Cap the retries at three',
  status: 'draft',
  sentTurnId: null,
  createdAt: AT,
  updatedAt: AT,
});

const parts = (count: number): ReadonlyArray<ImplementationCluster> =>
  Array.from({ length: count }, (_, index) => ({
    title: `Part ${index + 1} in payments-api`,
    instructions: 'Add backoff',
  }));

type SeedParams = {
  readonly parts?: number;
  readonly drafts?: ReadonlyArray<ArtifactComment>;
  readonly isRevising?: boolean;
  readonly ports?: ArtifactPorts;
};

const editOf = ({ parts: partCount = 0, drafts = [], isRevising = false, ports }: SeedParams) => {
  const plan = aPlan({ ...(partCount > 0 && { clusters: parts(partCount) }) });
  useAppStore.setState({
    sessions: [aSession({ id: PLAN_FIXTURE_SESSION })],
    sessionPlans: { [PLAN_FIXTURE_SESSION]: [plan] },
    sessionArtifacts: { [PLAN_FIXTURE_SESSION]: [aStoredPlan({}, plan)] },
    sessionPhaseRuns: {},
    artifactComments: { [PLAN_FIXTURE_SESSION]: drafts },
    agentTurnState: isRevising
      ? {
          [PLAN_FIXTURE_PLANNER]: {
            kind: 'running',
            runId: 'run-2' as ProviderRunId,
            startedAt: AT,
          },
        }
      : {},
  });
  const facts = ARTIFACT_KIND.facts({
    state: useAppStore.getState(),
    target: {
      kind: 'artifact',
      sessionId: PLAN_FIXTURE_SESSION,
      subject: { kind: 'stored', artifactId: PLAN_FIXTURE_ID, isPlanRunning: false },
      ...(ports !== undefined && { ports }),
    },
  });
  if (facts === null) {
    throw new Error('the plan facts are missing');
  }
  return resolveActions({ definitions: ARTIFACT_KIND.actions, facts }).find(
    (action) => action.id === 'artifact.edit',
  );
};

describe('Edit on a plan', () => {
  it('is open for a single plan', () => {
    expect(editOf({})?.blockedReason).toBeNull();
  });

  it('waits while the planner revises', () => {
    expect(editOf({ isRevising: true })?.blockedReason).toBe('The planner is revising this plan');
  });

  it('asks to send or discard unsent comments first, counting only drafts of this plan', () => {
    const drafts = [aDraft('c-1'), aDraft('c-2'), { ...aDraft('c-3'), status: 'sent' as const }];

    expect(editOf({ drafts })?.blockedReason).toBe('Send or discard your 2 comments first');
  });

  it('is blocked for a plan that runs as parallel parts, naming how many', () => {
    expect(editOf({ parts: 3 })?.blockedReason).toBe(
      'This plan runs as 3 parallel parts. Ask the planner to change it.',
    );
  });

  it('gives a reason the page supplies precedence over the plan rules', () => {
    const ports = { edit: { run: () => undefined, blockedReason: 'Saving is off' } };

    expect(editOf({ parts: 2, ports })?.blockedReason).toBe('Saving is off');
  });
});
