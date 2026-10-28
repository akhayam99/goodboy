import {
  brandId,
  type Agent,
  type IsoDateTime,
  type MountId,
  type OpenQuestion,
  type OpenQuestionId,
  type Project,
  type ProjectId,
  type ProviderRunId,
  type Session,
  type SessionExternalTask,
  type SessionProjectMount,
  type TurnEvent,
} from '@goodboy/types';
import { agentPlace, useAppStore } from '../../../../../store';
import { nowIso } from '../../../../../store/slices/project-mounts/nowIso';
import { castAutoScene } from '../../demo/director/castAutoScene';
import { AUTO_STORY, GUARD_BRANCH } from '../../demo/director/autoStory';
import { linearBindingOf } from '../brand/kickoffIssues';
import { seedActivityRunScene } from '../activityRunSeed';
import {
  AUTO_PLAN_ID,
  AUTO_ROOT_ID,
  AUTO_SESSION,
  PLANNER_ID,
  autoSceneOf,
} from '../u24/autoSceneSeed';
import { STORY_ISSUE, STORY_PLANNER, STORY_QUESTION } from './storyContent';

export type StoryStage = 'draft' | 'asking';

export const STORY_SESSION_ID = AUTO_SESSION.id;
export const STORY_PLANNER_ID = PLANNER_ID;
export const STORY_PLAN_ID = AUTO_PLAN_ID;
export const STORY_ROOT_ID = AUTO_ROOT_ID;

const QUESTION_ID = brandId<OpenQuestionId>({ value: 'demo-story-question-repeat' });
const PLANNER_RUN = brandId<ProviderRunId>({ value: 'demo-story-planner-run-claude' });

export const STORY_BRIEF = [STORY_ISSUE.title, '', STORY_ISSUE.description].join('\n');

const IDLE_LOADING = {
  agents: false,
  transcript: false,
  telemetry: false,
  slots: false,
  plans: false,
  summary: false,
};

type ProjectsParams = {
  readonly projects: ReadonlyArray<Project>;
};

const projectsOf = ({ projects }: ProjectsParams): ReadonlyArray<Project> => {
  const [payments, relay] = projects;
  if (payments === undefined || relay === undefined) {
    return projects;
  }
  const ledger: Project = {
    ...relay,
    id: brandId<ProjectId>({ value: 'demo-story-project-ledger-core' }),
    name: 'ledger-core',
    rootPath: '~/code/harborline/ledger-core',
  };
  return [payments, ledger, relay];
};

type MountParams = {
  readonly project: Project;
  readonly branch: string;
};

const mountOf = ({ project, branch }: MountParams): SessionProjectMount => ({
  mountId: brandId<MountId>({ value: `demo-story-mount-${project.name}` }),
  projectId: project.id,
  mountName: project.name,
  worktreePath: `${project.rootPath}-${branch.split('/').at(-1) ?? 'work'}`,
  lastWorktreePath: null,
  repoRoot: project.rootPath,
  branch,
  baseBranch: 'main',
  parallelIndex: 0,
  diskState: 'present',
  revision: 1,
  sessionId: STORY_SESSION_ID,
  isAttached: true,
});

type SessionParams = {
  readonly at: IsoDateTime;
  readonly project: Project;
};

const sessionOf = ({ at, project }: SessionParams): Session => ({
  id: STORY_SESSION_ID,
  workspaceId: project.workspaceId,
  goal: STORY_ISSUE.title,
  state: { kind: 'idle', lastActivityAt: at },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: true,
  activeProjectId: project.id,
  createdAt: at,
  updatedAt: at,
});

type TaskParams = {
  readonly at: IsoDateTime;
};

const taskOf = ({ at }: TaskParams): SessionExternalTask => ({
  sessionId: STORY_SESSION_ID,
  provider: 'linear',
  externalId: 'demo-story-linear-hbl-412',
  identifier: STORY_ISSUE.identifier,
  url: 'https://example.invalid/linear/HBL-412',
  title: STORY_ISSUE.title,
  createdAt: at,
});

type EventsParams = {
  readonly at: IsoDateTime;
};

const plannerEventsOf = ({ at }: EventsParams): ReadonlyArray<TurnEvent> => [
  {
    kind: 'user_text',
    runId: PLANNER_RUN,
    text: STORY_BRIEF,
    provider: 'anthropic',
    model: 'claude-opus-5-5',
    at,
  },
  { kind: 'assistant_text', runId: PLANNER_RUN, delta: STORY_PLANNER.intro, at },
  { kind: 'done', runId: PLANNER_RUN, at },
];

const rootEventsOf = ({ at }: EventsParams): ReadonlyArray<TurnEvent> => {
  const run = brandId<ProviderRunId>({ value: 'demo-story-root-run' });
  return [
    { kind: 'user_text', runId: run, text: STORY_BRIEF, at },
    { kind: 'assistant_text', runId: run, delta: AUTO_STORY.first, at },
  ];
};

const questionOf = ({ at }: EventsParams): OpenQuestion => ({
  id: QUESTION_ID,
  sessionId: STORY_SESSION_ID,
  createdByAgentId: PLANNER_ID,
  turnOrdinal: 1,
  text: STORY_QUESTION.text,
  suggestedAnswers: [...STORY_QUESTION.options],
  recommendedAnswer: STORY_QUESTION.recommended,
  selectMode: 'one',
  isBlocking: true,
  userAnswer: null,
  status: 'open',
  createdAt: at,
});

type AgentsParams = {
  readonly agents: ReadonlyArray<Agent>;
};

const plannerAgentsOf = ({ agents }: AgentsParams): ReadonlyArray<Agent> =>
  agents.map((agent) =>
    agent.id === PLANNER_ID
      ? {
          ...agent,
          status: 'completed',
          providerOverride: 'anthropic',
          modelOverride: 'claude-opus-5-5',
        }
      : agent,
  );

export const seedStoryAsking = (): Session | null => {
  const workspaceProjects = useAppStore.getState().projects;
  const at = nowIso({});
  const payments = workspaceProjects[0];
  const ledger = workspaceProjects[1];
  if (payments === undefined || ledger === undefined) {
    return null;
  }
  const { navigate } = useAppStore.getInitialState();
  const scene = castAutoScene({ scene: autoSceneOf({ state: 'delegating' }) });
  const mounts = [
    mountOf({ project: payments, branch: GUARD_BRANCH }),
    mountOf({ project: ledger, branch: 'main' }),
  ];
  const session = sessionOf({ at, project: payments });
  useAppStore.setState({
    navigate,
    sessions: [session],
    currentSessionId: STORY_SESSION_ID,
    selectedAgentId: { [STORY_SESSION_ID]: PLANNER_ID },
    agentPane: { [STORY_SESSION_ID]: 'transcript' },
    activeLens: { [STORY_SESSION_ID]: null },
    sessionPhaseRuns: { [STORY_SESSION_ID]: plannerAgentsOf({ agents: scene.agents }) },
    autoTreeViews: {
      [STORY_SESSION_ID]: [
        { ...scene.view, tree: { ...scene.view.tree, turnsUsed: 1 }, artifacts: [] },
      ],
    },
    agentTurnState: {
      [AUTO_ROOT_ID]: { kind: 'idle', lastActivityAt: at },
      [PLANNER_ID]: { kind: 'idle', lastActivityAt: at },
    },
    transcripts: {
      [AUTO_ROOT_ID]: rootEventsOf({ at }),
      [PLANNER_ID]: plannerEventsOf({ at }),
    },
    sessionOpenQuestions: { [STORY_SESSION_ID]: [questionOf({ at })] },
    sessionAnsweredQuestions: { [STORY_SESSION_ID]: [] },
    sessionDismissedQuestions: { [STORY_SESSION_ID]: [] },
    sessionPlans: { [STORY_SESSION_ID]: [] },
    sessionArtifacts: { [STORY_SESSION_ID]: [] },
    artifactComments: { [STORY_SESSION_ID]: [] },
    sessionWorkflows: { [STORY_SESSION_ID]: [] },
    sessionExternalTasks: { [STORY_SESSION_ID]: [taskOf({ at })] },
    sessionProjectMounts: { [STORY_SESSION_ID]: mounts },
    sessionActiveProject: { [STORY_SESSION_ID]: payments.id },
    sessionActiveMount: { [STORY_SESSION_ID]: mounts[0]?.mountId ?? null },
    sessionWorktrees: { [STORY_SESSION_ID]: mounts.map((mount) => mount.worktreePath) },
    sessionBranches: { [STORY_SESSION_ID]: GUARD_BRANCH },
    sessionEvents: { [STORY_SESSION_ID]: [] },
    sessionDecisions: { [STORY_SESSION_ID]: [] },
    sessionContextItems: { [STORY_SESSION_ID]: [] },
    sessionGithub: {},
    mountGithub: {},
    sessionProjectPrs: { [STORY_SESSION_ID]: {} },
    sessionLoading: { [STORY_SESSION_ID]: IDLE_LOADING },
    openSessionDraftWorkspaceId: null,
  });
  useAppStore.getState().navigate({
    to: agentPlace({ sessionId: STORY_SESSION_ID, agentId: PLANNER_ID }),
    drawer: null,
  });
  return session;
};

type SeedParams = {
  readonly stage: StoryStage;
};

export const seedStoryWorld = ({ stage }: SeedParams): void => {
  seedActivityRunScene();
  const { navigate, openExternalTaskLens } = useAppStore.getInitialState();
  const base = useAppStore.getState();
  const workspace = base.workspaces[0];
  const workspaceProjects = projectsOf({ projects: base.projects });
  useAppStore.setState({
    navigate,
    openExternalTaskLens,
    projects: workspaceProjects,
    sessions: [],
    currentSessionId: null,
    selectedAgentId: {},
    sessionDrafts: {},
    openSessionDraftWorkspaceId: null,
    workspaceIntegrations:
      workspace === undefined
        ? {}
        : { [workspace.id]: [linearBindingOf({ workspaceId: workspace.id })] },
    notifications: [],
    notificationsLoading: false,
    notificationCounts: [],
    loadNotifications: async () => undefined,
    markNotificationsRead: async () => undefined,
    clearNotifications: async () => undefined,
    loadPhaseTemplates: async () => undefined,
    loadStepLibrary: async () => undefined,
    loadAutoTrees: async () => undefined,
    loadPhaseRunsForSession: async () => undefined,
    loadSessionOpenQuestions: async () => undefined,
    loadSessionAnsweredQuestions: async () => undefined,
    loadSessionDismissedQuestions: async () => undefined,
    loadSessionEvents: async () => undefined,
    loadSessionArtifacts: async () => undefined,
    loadAgentTranscript: async () => undefined,
    markAgentViewed: async () => undefined,
    recordSessionEvent: async () => undefined,
    loadSetting: async () => 'true',
    phaseTemplates: {},
  });
  if (stage === 'asking') {
    seedStoryAsking();
  }
};
