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
import { NOT_REVISING } from '../../features/plans/planRevising';
import type { ArtifactGeneration } from '../../features/artifacts/artifactCollection';
import type { ArtifactFacts } from '../../features/actions/kinds/artifact';

export const SESSION = 'session-harborline' as SessionId;
export const AGENT = 'agent-planner' as AgentId;
export const ARTIFACT = 'artifact-payout' as ArtifactId;
export const NOW = '2026-09-14T16:40:00.000Z' as IsoDateTime;

export const plan = ({
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

export const report = ({ status }: { readonly status: ArtifactStatus }): ReportArtifact => ({
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

export const wireframe = ({ status }: { readonly status: ArtifactStatus }): WireframeArtifact => ({
  ...report({ status }),
  kind: 'wireframe',
  title: 'Acme refund approval flow',
  sourceFormat: 'json',
  sourceText: '{}',
  metadata: { fidelity: 'low', designProfile: {} },
});

export const base: Omit<
  ArtifactFacts,
  'kind' | 'title' | 'plan' | 'stored' | 'planStatus' | 'status'
> = {
  sessionId: SESSION,
  workspaceSlug: 'harborline',
  isPlanRunning: false,
  planRevising: NOT_REVISING,
  planRun: null,
  planDrafts: [],
  plannerQuestionCount: 0,
  isPlanHeldByAuto: false,
  planNextStepName: null,
  generation: null,
  kickoff: 'a kickoff',
  ports: {},
};

export const planFacts = ({
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

export const reportFacts = ({ status }: { readonly status: ArtifactStatus }): ArtifactFacts => ({
  ...base,
  kind: 'report',
  title: 'Q3 reconciliation drift',
  plan: null,
  stored: report({ status }),
  planStatus: null,
  status,
});

export const wireframeFacts = ({ status }: { readonly status: ArtifactStatus }): ArtifactFacts => ({
  ...base,
  kind: 'wireframe',
  title: 'Acme refund approval flow',
  plan: null,
  stored: wireframe({ status }),
  planStatus: null,
  status,
});

export const generationFacts = ({
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

export const COPIES = [
  'artifact.copySource menu',
  'artifact.saveSource menu',
  'artifact.openInBrowser menu',
  'artifact.showInFinder menu',
];
export const WIREFRAME_COPIES = [
  'artifact.copySource menu',
  'artifact.saveSource menu',
  'artifact.openInBrowser secondary',
  'artifact.showInFinder menu',
];
export const DELETE = 'artifact.delete inline';
export const FOR_GOOD = 'artifact.deletePermanently inline';

export const ARTIFACT_STATES: ReadonlyArray<{
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
