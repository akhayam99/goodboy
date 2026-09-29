import type {
  IsoDateTime,
  MountId,
  Project,
  Session,
  SessionId,
  SessionProjectMount,
} from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { EMPTY_LOADING } from '../../../../store/session-mutators';
import type { AppStore } from '../../../../store/store';

type Input = Parameters<AppStore['createSession']>[0];

type MountParams = {
  readonly project: Project;
  readonly sessionId: SessionId;
};

const mountOf = ({ project, sessionId }: MountParams): SessionProjectMount => ({
  projectId: project.id,
  mountName: project.name,
  worktreePath: project.rootPath,
  repoRoot: project.rootPath,
  branch: `hl/${project.name}`,
  mountId: `mock-mount-${sessionId}-${project.name}` as MountId,
  sessionId,
  lastWorktreePath: null,
  baseBranch: null,
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 0,
});

const createSession = async ({
  workspaceId,
  title,
  goal,
  projectId,
  additionalProjectIds,
}: Input): Promise<{ session: Session }> => {
  const state = useAppStore.getState();
  const now = new Date().toISOString() as IsoDateTime;
  const session: Session = {
    id: `mock-chat-session-started-${state.sessions.length}` as SessionId,
    workspaceId,
    goal: (title ?? goal).trim(),
    state: { kind: 'draft' },
    contextSlots: [],
    providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
    permissionMode: 'default',
    workflowRuns: [],
    autoRun: false,
    titleUserEdited: false,
    createdAt: now,
    updatedAt: now,
  };
  const wanted = [projectId, ...(additionalProjectIds ?? [])];
  const projects = state.projects.filter((project) => wanted.includes(project.id));
  useAppStore.setState({
    sessions: [session, ...state.sessions],
    currentSessionId: session.id,
    sessionSlots: {
      ...state.sessionSlots,
      [session.id]: [{ key: 'goal', value: goal.trim(), enabled: true }],
    },
    sessionPhaseRuns: { ...state.sessionPhaseRuns, [session.id]: [] },
    sessionEvents: { ...state.sessionEvents, [session.id]: [] },
    sessionLoading: { ...state.sessionLoading, [session.id]: EMPTY_LOADING },
    sessionProjectMounts: {
      ...state.sessionProjectMounts,
      [session.id]: projects.map((project) => mountOf({ project, sessionId: session.id })),
    },
    sessionBranches: { ...state.sessionBranches, [session.id]: '' },
    sessionWorktrees: { ...state.sessionWorktrees, [session.id]: [] },
  });
  return { session };
};

const setSessionConfig: AppStore['setSessionConfig'] = async (sessionId, fields) => {
  useAppStore.setState((state) => ({
    sessions: state.sessions.map((session) =>
      session.id === sessionId
        ? {
            ...session,
            ...(fields.effort != null && { effort: fields.effort }),
            ...(fields.modelOverride != null && { modelOverride: fields.modelOverride }),
            ...(fields.providerOverride != null && { providerOverride: fields.providerOverride }),
          }
        : session,
    ),
  }));
};

const setCurrentSession: AppStore['setCurrentSession'] = async (id) => {
  useAppStore.setState({ currentSessionId: id });
};

const doNothing = async (): Promise<void> => undefined;

const ensureSessionSlots: AppStore['ensureSessionSlots'] = async (sessionId) =>
  useAppStore.getState().sessionSlots[sessionId] ?? [];

export const installChatWorkStubs = (): void => {
  useAppStore.setState({
    createSession,
    setSessionConfig,
    setCurrentSession,
    loadPhaseRunsForSession: doNothing,
    ensureSessionSlots,
    selectAgent: doNothing,
  });
};
