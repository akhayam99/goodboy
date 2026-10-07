// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type {
  AgentId,
  ArtifactId,
  ArtifactStatus,
  IsoDateTime,
  PlanWithCount,
  ReportArtifact,
  SessionId,
  WireframeArtifact,
} from '@goodboy/types';
import { matrixOf } from '../../../__tests__/helpers/actionMatrix';
import { NOT_REVISING } from '../../plans/planRevising';
import type { ArtifactGeneration } from '../../artifacts/artifactCollection';
import { resolveActions } from '../resolveActions';
import { ARTIFACT_KIND, type ArtifactFacts } from './artifact';

const SESSION = 'session-harborline' as SessionId;
const AGENT = 'agent-planner' as AgentId;
const ARTIFACT = 'artifact-payout' as ArtifactId;
const NOW = '2026-09-14T16:40:00.000Z' as IsoDateTime;

const plan = ({
  status,
  consumptionCount = 0,
}: {
  readonly status: ArtifactStatus;
  readonly consumptionCount?: number;
}): PlanWithCount => ({
  id: ARTIFACT,
  sessionId: SESSION,
  agentId: AGENT,
  title: 'Speed up the payout export',
  bodyMd: '## Goal',
  status,
  createdAt: NOW,
  updatedAt: NOW,
  consumptionCount,
  ...(consumptionCount > 0 && {
    lastConsumer: { agentId: 'agent-implementer' as AgentId, name: 'Implementer 3' },
  }),
});

const report = ({ status }: { readonly status: ArtifactStatus }): ReportArtifact => ({
  id: ARTIFACT,
  sessionId: SESSION,
  agentId: AGENT,
  workflowRunId: null,
  kind: 'report',
  schemaVersion: 1,
  title: 'Q3 reconciliation drift',
  sourceFormat: 'markdown',
  sourceText: '# Q3 reconciliation drift',
  metadata: { reportType: 'session-summary' },
  status,
  revision: 1,
  sourceTurnId: null,
  createdAt: NOW,
  updatedAt: NOW,
  openedAt: null,
});

const wireframe = ({ status }: { readonly status: ArtifactStatus }): WireframeArtifact => ({
  ...report({ status }),
  kind: 'wireframe',
  title: 'Acme refund approval flow',
  sourceFormat: 'json',
  sourceText: '{}',
  metadata: { fidelity: 'low', designProfile: {} },
});

const base: Omit<ArtifactFacts, 'kind' | 'title' | 'plan' | 'stored' | 'planStatus' | 'status'> = {
  sessionId: SESSION,
  workspaceSlug: 'harborline',
  isPlanRunning: false,
  planRevising: NOT_REVISING,
  generation: null,
  kickoff: 'a kickoff',
  ports: {},
};

const planFacts = ({
  status,
  isPlanRunning = false,
  consumptionCount = 0,
}: {
  readonly status: ArtifactStatus;
  readonly isPlanRunning?: boolean;
  readonly consumptionCount?: number;
}): ArtifactFacts => ({
  ...base,
  kind: 'plan',
  title: 'Speed up the payout export',
  plan: plan({ status, consumptionCount }),
  stored: null,
  planStatus: status,
  status,
  isPlanRunning,
});

const reportFacts = ({ status }: { readonly status: ArtifactStatus }): ArtifactFacts => ({
  ...base,
  kind: 'report',
  title: 'Q3 reconciliation drift',
  plan: null,
  stored: report({ status }),
  planStatus: null,
  status,
});

const wireframeFacts = ({ status }: { readonly status: ArtifactStatus }): ArtifactFacts => ({
  ...base,
  kind: 'wireframe',
  title: 'Acme refund approval flow',
  plan: null,
  stored: wireframe({ status }),
  planStatus: null,
  status,
});

const generationFacts = ({
  state,
  canStop,
}: {
  readonly state: ArtifactGeneration['state'];
  readonly canStop: boolean;
}): ArtifactFacts => ({
  ...base,
  kind: 'report',
  title: 'Session summary',
  plan: null,
  stored: null,
  planStatus: null,
  status: null,
  generation: {
    agentId: AGENT,
    kind: 'report',
    title: 'Session summary',
    state,
    startedAt: NOW,
    provider: null,
    model: null,
    isTurnRunning: state === 'generating',
    scouts: [],
    canStop,
  },
});

const COPIES = [
  'artifact.copySource menu',
  'artifact.saveSource menu',
  'artifact.openInBrowser menu',
  'artifact.showInFinder menu',
];
const WIREFRAME_COPIES = [
  'artifact.copySource menu',
  'artifact.saveSource menu',
  'artifact.openInBrowser secondary',
  'artifact.showInFinder menu',
];
const DELETE = 'artifact.delete inline';
const FOR_GOOD = 'artifact.deletePermanently inline';

const STATES: ReadonlyArray<{
  readonly name: string;
  readonly facts: ArtifactFacts;
  readonly expected: ReadonlyArray<string>;
}> = [
  {
    name: 'plan ready to run',
    facts: planFacts({ status: 'active' }),
    expected: [
      'artifact.open menu',
      'artifact.openAgent menu',
      'artifact.runPlan primary',
      'artifact.edit secondary',
      ...COPIES,
      DELETE,
    ],
  },
  {
    name: 'plan running',
    facts: planFacts({ status: 'consumed', isPlanRunning: true, consumptionCount: 1 }),
    expected: ['artifact.open menu', 'artifact.openAgent menu', ...COPIES, DELETE],
  },
  {
    name: 'plan that ran',
    facts: planFacts({ status: 'consumed', consumptionCount: 1 }),
    expected: [
      'artifact.open menu',
      'artifact.openAgent menu',
      'artifact.runAgain secondary',
      ...COPIES,
      DELETE,
    ],
  },
  {
    name: 'plan replaced by a newer one',
    facts: planFacts({ status: 'superseded' }),
    expected: [
      'artifact.open menu',
      'artifact.openAgent menu',
      'artifact.runAgain secondary',
      ...COPIES,
      DELETE,
    ],
  },
  {
    name: 'plan deleted',
    facts: planFacts({ status: 'discarded' }),
    expected: [
      'artifact.open menu',
      'artifact.openAgent menu',
      'artifact.restore secondary',
      ...COPIES,
      FOR_GOOD,
    ],
  },
  {
    name: 'report',
    facts: reportFacts({ status: 'active' }),
    expected: [
      'artifact.open menu',
      'artifact.edit secondary',
      'artifact.regenerate menu',
      ...COPIES,
      DELETE,
    ],
  },
  {
    name: 'report replaced',
    facts: reportFacts({ status: 'superseded' }),
    expected: [
      'artifact.open menu',
      'artifact.edit secondary',
      'artifact.regenerate menu',
      ...COPIES,
      DELETE,
    ],
  },
  {
    name: 'report deleted',
    facts: reportFacts({ status: 'discarded' }),
    expected: ['artifact.open menu', 'artifact.restore secondary', ...COPIES, FOR_GOOD],
  },
  {
    name: 'wireframe',
    facts: wireframeFacts({ status: 'active' }),
    expected: ['artifact.open menu', 'artifact.newVariant menu', ...WIREFRAME_COPIES, DELETE],
  },
  {
    name: 'wireframe deleted',
    facts: wireframeFacts({ status: 'discarded' }),
    expected: ['artifact.open menu', 'artifact.restore secondary', ...WIREFRAME_COPIES, FOR_GOOD],
  },
  {
    name: 'generating, can stop',
    facts: generationFacts({ state: 'generating', canStop: true }),
    expected: ['artifact.openAgent menu', 'artifact.stop secondary'],
  },
  {
    name: 'generation waiting on you',
    facts: generationFacts({ state: 'waiting', canStop: false }),
    expected: ['artifact.openAgent menu'],
  },
  {
    name: 'generation that produced nothing',
    facts: generationFacts({ state: 'unproduced', canStop: false }),
    expected: ['artifact.openAgent menu', 'artifact.retry secondary'],
  },
];

describe('artifact verbs by kind and state', () => {
  it.each(STATES)('$name', ({ facts, expected }) => {
    expect(matrixOf({ definitions: ARTIFACT_KIND.actions, facts })).toEqual(expected);
  });

  it.each(STATES)('$name: one primary at most', ({ facts }) => {
    const primaries = resolveActions({ definitions: ARTIFACT_KIND.actions, facts }).filter(
      (action) => action.slot === 'primary',
    );
    expect(primaries.length).toBeLessThanOrEqual(1);
  });

  it('offers Delete on every stored artifact that is not deleted, and never on a generation', () => {
    const offered = STATES.filter(({ facts }) =>
      matrixOf({ definitions: ARTIFACT_KIND.actions, facts }).includes(DELETE),
    ).map(({ name }) => name);
    expect(offered).toEqual([
      'plan ready to run',
      'plan running',
      'plan that ran',
      'plan replaced by a newer one',
      'report',
      'report replaced',
      'wireframe',
    ]);
  });

  it('offers Delete permanently only on a deleted artifact', () => {
    const offered = STATES.filter(({ facts }) =>
      matrixOf({ definitions: ARTIFACT_KIND.actions, facts }).includes(FOR_GOOD),
    ).map(({ name }) => name);
    expect(offered).toEqual(['plan deleted', 'report deleted', 'wireframe deleted']);
  });

  it('runs Delete at once with an Undo and asks before deleting for good', () => {
    const live = resolveActions({
      definitions: ARTIFACT_KIND.actions,
      facts: reportFacts({ status: 'active' }),
    }).find((action) => action.id === 'artifact.delete');
    expect([live?.isUndoable, live?.confirm]).toEqual([true, null]);
    const gone = resolveActions({
      definitions: ARTIFACT_KIND.actions,
      facts: reportFacts({ status: 'discarded' }),
    }).find((action) => action.id === 'artifact.deletePermanently');
    expect(gone?.confirm?.role).toBe('danger');
  });

  it('blocks Run plan with a reason while the planner revises the plan, and only then', () => {
    const runPlanOf = (planRevising: ArtifactFacts['planRevising']) =>
      resolveActions({
        definitions: ARTIFACT_KIND.actions,
        facts: { ...planFacts({ status: 'active' }), planRevising },
      }).find((action) => action.id === 'artifact.runPlan');
    expect(runPlanOf({ kind: 'revising', nextRevision: 2 })?.blockedReason).toBe(
      'The planner is revising this plan',
    );
    expect(runPlanOf(NOT_REVISING)?.blockedReason).toBeNull();
  });

  it('says deleting for good also loses the run history', () => {
    const ran = resolveActions({
      definitions: ARTIFACT_KIND.actions,
      facts: planFacts({ status: 'discarded', consumptionCount: 2 }),
    }).find((action) => action.id === 'artifact.deletePermanently');
    expect(ran?.confirm?.description).toContain('Run by Implementer 3 +1 more');
  });
});
