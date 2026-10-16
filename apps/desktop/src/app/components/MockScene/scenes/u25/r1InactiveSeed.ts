import type {
  Agent,
  AgentId,
  IsoDateTime,
  MountId,
  OpenQuestionId,
  Project,
  ProjectId,
  ProviderRunId,
  Session,
  SessionGroupKey,
  SessionId,
  SessionPageView,
  SessionProjectMount,
  TurnState,
  WorkspaceGitStatus,
} from '@goodboy/types';
import { brandId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { projectById } from '../../../../../store/slices/projects/projectIndex';
import { sessionById } from '../../../../../store/slices/sessions/sessionIndex';
import { SESSION, WORKSPACE_ID, seedWorkflowScene } from '../workflowSeed';
import { seedWorkspaceChrome } from '../audit/workspaceChrome';
import { seedLoadedSession } from '../u21/seedLoadedSession';
import { sceneClock } from '../../sceneClock';
import { installSceneDatabase } from '../sceneDatabase';
import { sessionPinsKey } from '../../../../../store/slices/session-pins/sessionPinsKey';
import { serializeSessionPins } from '../../../../../store/slices/session-pins/parseSessionPins';

const clock = sceneClock({ anchor: '2026-10-16T12:00:00.000Z' });

const at = (iso: string): IsoDateTime => clock.iso({ at: iso });

const LEDGER_ID = brandId<ProjectId>({ value: 'mock-inactive-project-ledger-core' });
const RELAY_ID = brandId<ProjectId>({ value: 'mock-inactive-project-notify-relay' });
const PAYMENTS_ID = brandId<ProjectId>({ value: 'mock-inactive-project-payments-api' });

type SlugParams = {
  readonly slug: string;
};

const idOf = ({ slug }: SlugParams): SessionId =>
  brandId<SessionId>({ value: `mock-inactive-session-${slug}` });

type SessionSeed = {
  readonly slug: string;
  readonly goal: string;
  readonly projectId: ProjectId;
  readonly activeAt: string;
  readonly openedAt: string;
  readonly state?: TurnState;
};

const SEEDS: ReadonlyArray<SessionSeed> = [
  {
    slug: 'ledger-export',
    goal: 'Reconcile the ledger export',
    projectId: LEDGER_ID,
    activeAt: '2026-10-02T09:00:00.000Z',
    openedAt: '2026-10-02T09:00:00.000Z',
  },
  {
    slug: 'webhook',
    goal: 'Stop notify-relay posting a webhook twice',
    projectId: RELAY_ID,
    activeAt: '2026-10-08T09:00:00.000Z',
    openedAt: '2026-10-08T09:00:00.000Z',
    state: {
      kind: 'running',
      runId: brandId<ProviderRunId>({ value: 'mock-inactive-run-webhook' }),
      startedAt: at('2026-10-16T11:50:00.000Z'),
    },
  },
  {
    slug: 'retries',
    goal: 'Stop notify-relay retries on a 409',
    projectId: RELAY_ID,
    activeAt: '2026-10-06T09:00:00.000Z',
    openedAt: '2026-10-06T09:00:00.000Z',
  },
  {
    slug: 'idempotency',
    goal: 'Add idempotency keys to payments-api',
    projectId: PAYMENTS_ID,
    activeAt: '2026-10-09T09:00:00.000Z',
    openedAt: '2026-10-09T09:00:00.000Z',
  },
  {
    slug: 'rate-limit',
    goal: 'Tune the payments rate limiter',
    projectId: PAYMENTS_ID,
    activeAt: '2026-10-16T09:00:00.000Z',
    openedAt: '2026-10-15T17:00:00.000Z',
  },
  {
    slug: 'settlement',
    goal: 'Backfill the settlement dates',
    projectId: LEDGER_ID,
    activeAt: '2026-10-05T09:00:00.000Z',
    openedAt: '2026-10-16T11:00:00.000Z',
  },
  {
    slug: 'digest',
    goal: 'Write the notify-relay digest',
    projectId: RELAY_ID,
    activeAt: '2026-10-12T09:00:00.000Z',
    openedAt: '2026-10-11T09:00:00.000Z',
  },
  {
    slug: 'payments-pages',
    goal: 'Paginate the payments list',
    projectId: PAYMENTS_ID,
    activeAt: '2026-10-10T09:00:00.000Z',
    openedAt: '2026-10-10T09:00:00.000Z',
  },
  {
    slug: 'queue',
    goal: 'Move the ledger export to a queue',
    projectId: LEDGER_ID,
    activeAt: '2026-10-04T09:00:00.000Z',
    openedAt: '2026-10-03T09:00:00.000Z',
  },
];

const PINNED_SLUG = 'ledger-export';
const ASKING_SLUG = 'retries';
const DRAFT_SLUG = 'idempotency';
const OPEN_SLUG = 'settlement';

const sessionOf = ({ slug, goal, projectId, activeAt, openedAt, state }: SessionSeed): Session => ({
  ...SESSION,
  id: idOf({ slug }),
  goal,
  state: state ?? { kind: 'idle', lastActivityAt: at(activeAt) },
  contextSlots: [],
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: true,
  activeProjectId: projectId,
  createdAt: at('2026-09-20T09:00:00.000Z'),
  updatedAt: at(activeAt),
  lastOpenedAt: at(openedAt),
});

type ProjectParams = {
  readonly base: Project;
  readonly id: ProjectId;
  readonly name: string;
};

type MountParams = {
  readonly session: Session;
  readonly project: Project;
};

const projectOf = ({ base, id, name }: ProjectParams): Project => ({
  ...base,
  id,
  name,
  rootPath: `/mock/northwind/${name}-source`,
});

const mountOf = ({ session, project }: MountParams) =>
  ({
    mountId: brandId<MountId>({ value: `mock-inactive-mount-${session.id}` }),
    sessionId: session.id,
    projectId: project.id,
    mountName: project.name,
    worktreePath: `/mock/northwind/${project.name}/${session.id}`,
    lastWorktreePath: null,
    repoRoot: project.rootPath,
    branch: `northwind/${session.id}`,
    baseBranch: 'main',
    parallelIndex: 0,
    isAttached: true,
    diskState: 'present',
    revision: 1,
  }) satisfies SessionProjectMount;

const draftAgent: Agent = {
  id: brandId<AgentId>({ value: 'mock-inactive-agent-idempotency' }),
  sessionId: idOf({ slug: DRAFT_SLUG }),
  ordinal: 1,
  name: 'Implement',
  status: 'completed',
  startedAt: at('2026-10-09T08:00:00.000Z'),
  lastFinishedAt: at('2026-10-09T09:00:00.000Z'),
  lastViewedAt: at('2026-10-09T09:05:00.000Z'),
};

const READY_STATUS: WorkspaceGitStatus = {
  state: 'ready',
  branch: 'main',
  headSubject: 'Bump the lockfile after the security patch',
  upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  upstream: 'origin/main',
  inProgress: null,
};

const installPinsDatabase = (): void => {
  const pins = useAppStore.getState().sessionPins[WORKSPACE_ID] ?? [];
  installSceneDatabase({
    settings: { [sessionPinsKey({ workspaceId: WORKSPACE_ID })]: serializeSessionPins({ pins }) },
    liveSessionIds: () => useAppStore.getState().sessions.map((session) => session.id),
    fallback: (command) =>
      command === 'project_git_status' ? READY_STATUS : new Promise<never>(() => undefined),
  });
};

type Params = {
  readonly group: SessionGroupKey;
  readonly pageView: SessionPageView;
};

export const seedInactiveSessions = ({ group, pageView }: Params): Session => {
  seedWorkflowScene();
  const base = useAppStore.getState().projects[0];
  if (base === undefined) {
    return SESSION;
  }
  const projects = [
    projectOf({ base, id: LEDGER_ID, name: 'ledger-core' }),
    projectOf({ base, id: RELAY_ID, name: 'notify-relay' }),
    projectOf({ base, id: PAYMENTS_ID, name: 'payments-api' }),
  ];
  const sessions = SEEDS.map(sessionOf);
  const open = sessionById(sessions, idOf({ slug: OPEN_SLUG }));
  if (open === undefined) {
    return SESSION;
  }
  seedWorkspaceChrome({ session: open, siblings: sessions.filter((session) => session !== open) });
  seedLoadedSession({ session: open });
  const state = useAppStore.getState();
  useAppStore.setState({
    projects,
    sessionProjectMounts: Object.fromEntries(
      sessions.flatMap((session) => {
        const project = projectById(projects, session.activeProjectId);
        return project === undefined ? [] : [[session.id, [mountOf({ session, project })]]];
      }),
    ),
    sessionActiveProject: Object.fromEntries(
      SEEDS.map((seed) => [idOf({ slug: seed.slug }), seed.projectId]),
    ),
    sessionBranches: Object.fromEntries(
      sessions.map((session) => [session.id, `northwind/${session.id}`]),
    ),
    sessionPins: {
      [WORKSPACE_ID]: [
        { id: idOf({ slug: PINNED_SLUG }), at: Date.parse('2026-10-02T09:00:00.000Z') },
      ],
    },
    sessionOpenQuestions: {
      ...state.sessionOpenQuestions,
      [idOf({ slug: ASKING_SLUG })]: [
        {
          id: brandId<OpenQuestionId>({ value: 'mock-inactive-question-retries' }),
          sessionId: idOf({ slug: ASKING_SLUG }),
          text: 'Should a 409 count as delivered?',
          suggestedAnswers: [],
          isBlocking: true,
          userAnswer: null,
          status: 'open',
          createdAt: at('2026-10-06T09:00:00.000Z'),
        },
      ],
    },
    sessionPhaseRuns: { ...state.sessionPhaseRuns, [idOf({ slug: DRAFT_SLUG })]: [draftAgent] },
    agentDraft: { [draftAgent.id]: 'Check the retry header before the key lookup' },
    sessionGroupExpanded: {},
    sessionViewPrefs: {
      [WORKSPACE_ID]: {
        pageView,
        sort: 'needsYou',
        group,
        isArchivedShown: false,
        isFoldOpen: false,
        statusFilter: [],
      },
    },
  });
  installPinsDatabase();
  return open;
};
