import type {
  Agent,
  AgentId,
  IsoDateTime,
  MountId,
  OpenQuestion,
  OpenQuestionId,
  ProjectId,
  Session,
  SessionId,
  SessionProjectMount,
  Step,
  StepId,
  TurnState,
  Workflow,
  WorkflowId,
  WorkflowRun,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import type { StoryStore } from '../../store/storyHarness';

export const FIXTURE_NOW = '2026-09-27T09:00:00.000Z' as IsoDateTime;
export const WORKSPACE = 'ws-harborline' as WorkspaceId;
export const SESSION = 'session-payout-export' as SessionId;
export const AGENT = 'agent-maya' as AgentId;
export const RUN = 'run-settlement' as WorkflowRunId;
export const WORKFLOW = 'workflow-settlement' as WorkflowId;
export const STEP_PLAN = 'step-plan' as StepId;
export const STEP_BUILD = 'step-build' as StepId;

export const sessionFixture = (overrides: Partial<Session> = {}): Session => ({
  id: SESSION,
  workspaceId: WORKSPACE,
  goal: 'Speed up the payout export for large merchants',
  state: { kind: 'idle', lastActivityAt: FIXTURE_NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: true,
  createdAt: FIXTURE_NOW,
  updatedAt: FIXTURE_NOW,
  ...overrides,
});

export const agentFixture = (overrides: Partial<Agent> = {}): Agent => ({
  id: AGENT,
  sessionId: SESSION,
  ordinal: 0,
  name: 'Maya Lindqvist',
  status: 'completed',
  ...overrides,
});

export const mountFixture = (
  overrides: Partial<SessionProjectMount> = {},
): SessionProjectMount => ({
  mountId: 'mount-ledger-core' as MountId,
  sessionId: SESSION,
  projectId: 'project-ledger-core' as ProjectId,
  mountName: 'ledger-core',
  worktreePath: '/work/harborline/ledger-core-payout',
  lastWorktreePath: null,
  repoRoot: '/work/harborline/ledger-core',
  branch: 'hl/payout-export',
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
  ...overrides,
});

const step = ({ id, ordinal, name }: { id: StepId; ordinal: number; name: string }): Step => ({
  id,
  workflowId: WORKFLOW,
  ordinal,
  name,
  promptPrefix: '',
});

export const workflowFixture = (): Workflow => ({
  id: WORKFLOW,
  workspaceId: WORKSPACE,
  name: 'Settlement export',
  description: '',
  steps: [
    step({ id: STEP_PLAN, ordinal: 0, name: 'Plan' }),
    step({ id: STEP_BUILD, ordinal: 1, name: 'Build' }),
  ],
  createdAt: FIXTURE_NOW,
  updatedAt: FIXTURE_NOW,
});

export const runFixture = (overrides: Partial<WorkflowRun> = {}): WorkflowRun => ({
  id: RUN,
  workflowId: WORKFLOW,
  ordinal: 0,
  currentStep: 0,
  autoRun: false,
  triggerMode: 'immediate',
  executionMode: 'static',
  createdAt: FIXTURE_NOW,
  ...overrides,
});

export const stepAgent = ({
  id,
  stepId,
  status,
}: {
  readonly id: string;
  readonly stepId: StepId;
  readonly status: Agent['status'];
}): Agent =>
  agentFixture({
    id: id as AgentId,
    name: stepId === STEP_PLAN ? 'Plan' : 'Build',
    stepId,
    workflowRunId: RUN,
    status,
  });

export const questionFixture = (overrides: Partial<OpenQuestion> = {}): OpenQuestion => ({
  id: 'question-rounding' as OpenQuestionId,
  sessionId: SESSION,
  text: 'Round half up or half even for Northwind?',
  suggestedAnswers: [],
  isBlocking: true,
  userAnswer: null,
  status: 'open',
  createdAt: FIXTURE_NOW,
  ...overrides,
});

export type ActionSeed = {
  readonly session?: Session;
  readonly isArchived?: boolean;
  readonly agents?: ReadonlyArray<Agent>;
  readonly mounts?: ReadonlyArray<SessionProjectMount>;
  readonly branch?: string;
  readonly prUrl?: string | null;
  readonly questions?: ReadonlyArray<OpenQuestion>;
  readonly turnStates?: Readonly<Record<string, TurnState>>;
  readonly workflows?: ReadonlyArray<Workflow>;
};

export const seedActionState = ({
  useAppStore,
  seed,
}: {
  readonly useAppStore: StoryStore;
  readonly seed: ActionSeed;
}): void => {
  const session = seed.session ?? sessionFixture();
  const mounts = seed.mounts ?? [];
  const state = useAppStore.getState();
  useAppStore.setState({
    sessions: seed.isArchived === true ? [] : [session],
    archivedSessions: { [WORKSPACE]: seed.isArchived === true ? [session] : [] },
    currentWorkspaceId: WORKSPACE,
    sessionPhaseRuns: { [SESSION]: seed.agents ?? [] },
    sessionProjectMounts: { [SESSION]: mounts },
    sessionWorktrees: { [SESSION]: mounts.map((mount) => mount.worktreePath) },
    sessionBranches: seed.branch === undefined ? {} : { [SESSION]: seed.branch },
    sessionOpenQuestions: { [SESSION]: seed.questions ?? [] },
    sessionWorkflows: { [SESSION]: seed.workflows ?? [] },
    agentTurnState: { ...seed.turnStates },
    transcripts: {},
    sessionGithub:
      seed.prUrl == null
        ? {}
        : {
            [SESSION]: {
              ...(state.sessionGithub[SESSION] ?? {}),
              pr: { url: seed.prUrl },
            } as never,
          },
  });
};
