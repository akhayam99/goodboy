import type {
  Agent,
  AgentId,
  ArtifactId,
  IsoDateTime,
  MountId,
  OpenQuestion,
  OpenQuestionId,
  PlanArtifact,
  ProjectId,
  Session,
  SessionId,
  SessionProjectMount,
  StepId,
  WorkflowRun,
  WorkflowRunId,
} from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { SESSION, seedWorkflowScene } from '../workflowSeed';
import { seedWorkspaceChrome } from '../audit/workspaceChrome';
import { seedLoadedSession } from '../u21/seedLoadedSession';
import { sceneClock } from '../../sceneClock';

const clock = sceneClock({ anchor: '2026-10-07T10:00:00.000Z' });

const at = (iso: string): IsoDateTime => clock.iso({ at: iso });

const SESSION_ID = 'mock-pages-session-webhooks' as SessionId;

const RUN_IDS = ['mock-pages-run-retries', 'mock-pages-run-export'] as const;

const workflowRunOf = ({
  id,
  ordinal,
}: {
  readonly id: string;
  readonly ordinal: number;
}): WorkflowRun => ({
  id: id as WorkflowRunId,
  workflowId: 'mock-pages-workflow' as WorkflowRun['workflowId'],
  ordinal,
  currentStep: 0,
  autoRun: false,
  triggerMode: 'manual',
  executionMode: 'dynamic',
  createdAt: at('2026-10-07T08:00:00.000Z'),
});

const sessionOf = ({ isBusy }: { readonly isBusy: boolean }): Session => ({
  ...SESSION,
  id: SESSION_ID,
  goal: 'Retry failed webhook deliveries',
  state: { kind: 'idle', lastActivityAt: at('2026-10-07T09:55:00.000Z') },
  contextSlots: [],
  workflowRuns: isBusy ? RUN_IDS.map((id, ordinal) => workflowRunOf({ id, ordinal })) : [],
  autoRun: false,
  titleUserEdited: true,
  createdAt: at('2026-10-06T09:00:00.000Z'),
  updatedAt: at('2026-10-07T09:55:00.000Z'),
  lastOpenedAt: at('2026-10-07T09:58:00.000Z'),
});

const mountOf = ({ name }: { readonly name: string }): SessionProjectMount => ({
  mountId: `mock-pages-mount-${name}` as MountId,
  sessionId: SESSION_ID,
  projectId: `mock-pages-project-${name}` as ProjectId,
  mountName: name,
  worktreePath: `/mock/harborline/${name}/worktrees/webhook-retries`,
  lastWorktreePath: null,
  repoRoot: `/mock/harborline/${name}`,
  branch: 'harborline/webhook-retries',
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
});

const planOf = (index: number): PlanArtifact => ({
  id: `mock-pages-artifact-${index}` as ArtifactId,
  sessionId: SESSION_ID,
  agentId: 'mock-pages-agent-planner' as AgentId,
  workflowRunId: null,
  kind: 'plan',
  schemaVersion: 1,
  title: `Retry plan, round ${index}`,
  sourceFormat: 'markdown',
  sourceText: '# Retry plan',
  metadata: {},
  status: 'active',
  revision: 1,
  sourceTurnId: null,
  createdAt: at('2026-10-07T08:30:00.000Z'),
  updatedAt: at('2026-10-07T08:30:00.000Z'),
  openedAt: null,
});

const agentOf = ({
  slug,
  status,
  workflowRunId,
}: {
  readonly slug: string;
  readonly status: Agent['status'];
  readonly workflowRunId?: string;
}): Agent => ({
  id: `mock-pages-agent-${slug}` as AgentId,
  sessionId: SESSION_ID,
  ordinal: slug === 'implementer' ? 0 : 1,
  name: slug === 'implementer' ? 'Implementer' : 'Planner',
  status,
  ...(workflowRunId !== undefined && {
    workflowRunId: workflowRunId as WorkflowRunId,
    stepId: 'mock-pages-step-1' as StepId,
  }),
});

const questionOf = (): OpenQuestion => ({
  id: 'mock-pages-question-window' as OpenQuestionId,
  sessionId: SESSION_ID,
  text: 'Which retry window should the webhook use?',
  suggestedAnswers: ['Five minutes', 'One hour'],
  isBlocking: true,
  userAnswer: null,
  status: 'open',
  createdAt: at('2026-10-07T09:00:00.000Z'),
});

type Params = {
  readonly isBusy: boolean;
};

export const seedPagesScene = ({ isBusy }: Params): Session => {
  seedWorkflowScene();
  const session = sessionOf({ isBusy });
  seedWorkspaceChrome({ session, siblings: [] });
  seedLoadedSession({ session });
  const state = useAppStore.getState();
  useAppStore.setState({
    sessionOpenQuestions: {
      ...state.sessionOpenQuestions,
      [SESSION_ID]: isBusy ? [questionOf()] : [],
    },
    sessionArtifacts: {
      ...state.sessionArtifacts,
      [SESSION_ID]: isBusy ? [1, 2, 3, 4].map(planOf) : [],
    },
    sessionProjectMounts: {
      ...state.sessionProjectMounts,
      [SESSION_ID]: isBusy
        ? [mountOf({ name: 'payments-api' }), mountOf({ name: 'notify-relay' })]
        : [],
    },
    sessionPhaseRuns: {
      ...state.sessionPhaseRuns,
      [SESSION_ID]: isBusy
        ? [
            agentOf({ slug: 'implementer', status: 'running' }),
            agentOf({ slug: 'planner', status: 'running', workflowRunId: RUN_IDS[0] }),
          ]
        : [],
    },
  });
  return session;
};
