import type {
  PrMergeMethod,
  Project,
  ProjectId,
  PullRequestState,
  SessionId,
  Workflow,
  WorkflowId,
  Workspace,
  WorkspaceId,
  IntegrationBinding,
  WorkspaceIntegrationProvider,
} from '@goodboy/types';

const mobileSharedSessions = new Set<SessionId>();

export const markSessionMobileShared = (sessionId: SessionId): void => {
  mobileSharedSessions.add(sessionId);
};

export const isSessionMobileShared = (sessionId: SessionId): boolean =>
  mobileSharedSessions.has(sessionId);

export const clearMobileSharedSessions = (): void => {
  mobileSharedSessions.clear();
};

const MERGE_METHODS: ReadonlySet<string> = new Set<PrMergeMethod>(['squash', 'merge', 'rebase']);

export const isMergeMethod = (v: unknown): v is PrMergeMethod =>
  typeof v === 'string' && MERGE_METHODS.has(v);

export type MergeGate = { readonly ok: true } | { readonly ok: false; readonly reason: string };

export const evaluateMobileMerge = (
  pr: PullRequestState | null | undefined,
  method: string,
): MergeGate => {
  if (!isMergeMethod(method)) {
    return { ok: false, reason: `unsupported merge method: ${String(method)}` };
  }
  if (!pr) {
    return { ok: false, reason: 'no PR is associated with this session' };
  }
  if (pr.isDraft) {
    return { ok: false, reason: 'PR is a draft: mark it ready before merging' };
  }
  if (pr.state === 'merged' || pr.state === 'closed') {
    return { ok: false, reason: `PR is already ${pr.state}` };
  }
  if (pr.state === 'queued') {
    return { ok: false, reason: 'PR is already in the merge queue' };
  }
  if (pr.reviewDecision !== 'approved') {
    return { ok: false, reason: 'PR is not approved' };
  }
  if (pr.checks !== 'success') {
    return {
      ok: false,
      reason: pr.checks === 'failure' ? 'CI checks are failing' : 'CI checks are not green yet',
    };
  }
  if (pr.mergeable === false) {
    return { ok: false, reason: 'PR has conflicts: resolve them first' };
  }
  return { ok: true };
};

const CREATE_SESSION_PROVIDERS: ReadonlySet<string> = new Set<WorkspaceIntegrationProvider>([
  'linear',
  'sentry',
  'gitlab',
  'jira',
]);

const isCreateSessionProvider = (v: unknown): v is WorkspaceIntegrationProvider =>
  typeof v === 'string' && CREATE_SESSION_PROVIDERS.has(v);

export type CreateSessionGate =
  | {
      readonly ok: true;
      readonly workspaceId: WorkspaceId;
      readonly projectId: ProjectId;
      readonly provider: WorkspaceIntegrationProvider;
      readonly reservation: MobileCreateReservation;
    }
  | { readonly ok: false; readonly reason: string };

export type MobileCreateProject = Pick<Project, 'id' | 'name'>;

type ProjectChoice =
  | { readonly ok: true; readonly projectId: ProjectId }
  | { readonly ok: false; readonly reason: string };

const describeProjects = (projects: ReadonlyArray<MobileCreateProject>): string =>
  projects.map((project) => `${project.name} (${project.id})`).join(', ');

const chooseMobileProject = (args: {
  readonly projects: ReadonlyArray<MobileCreateProject>;
  readonly projectId: unknown;
}): ProjectChoice => {
  const { projects, projectId } = args;
  if (projects.length === 0) {
    return { ok: false, reason: 'this workspace has no project: add one on the desktop first' };
  }
  const requested = typeof projectId === 'string' && projectId.length > 0 ? projectId : undefined;
  if (requested !== undefined) {
    const picked = projects.find((project) => project.id === requested);
    if (picked === undefined) {
      return { ok: false, reason: `unknown project for this workspace: ${requested}` };
    }
    return { ok: true, projectId: picked.id };
  }
  const only = projects[0];
  if (projects.length === 1 && only !== undefined) {
    return { ok: true, projectId: only.id };
  }
  return {
    ok: false,
    reason: `this workspace has several projects: send projectId to pick the one this session works in (${describeProjects(projects)})`,
  };
};

const MOBILE_CREATE_WINDOW_MS = 60_000;
const MOBILE_CREATE_MAX_IN_WINDOW = 5;
const mobileCreateTimestamps: number[] = [];
let mobileCreatePending = 0;

export const clearMobileCreateRateState = (): void => {
  mobileCreateTimestamps.length = 0;
  mobileCreatePending = 0;
};

type MobileCreateReservation = {
  readonly commit: (now?: number) => void;
  readonly release: () => void;
};

const pruneExpired = (now: number): void => {
  const cutoff = now - MOBILE_CREATE_WINDOW_MS;
  let head = mobileCreateTimestamps[0];
  while (head !== undefined && head < cutoff) {
    mobileCreateTimestamps.shift();
    head = mobileCreateTimestamps[0];
  }
};

const isRateLimited = (now: number): boolean => {
  pruneExpired(now);
  return mobileCreateTimestamps.length + mobileCreatePending >= MOBILE_CREATE_MAX_IN_WINDOW;
};

const reserveSlot = (): MobileCreateReservation | null => {
  mobileCreatePending += 1;
  let settled = false;
  return {
    commit: (now: number = Date.now()) => {
      if (settled) {
        return;
      }
      settled = true;
      mobileCreatePending = Math.max(0, mobileCreatePending - 1);
      mobileCreateTimestamps.push(now);
    },
    release: () => {
      if (settled) {
        return;
      }
      settled = true;
      mobileCreatePending = Math.max(0, mobileCreatePending - 1);
    },
  };
};

export const evaluateMobileCreateSession = (args: {
  readonly workspaceId: unknown;
  readonly provider: unknown;
  readonly projectId?: unknown;
  readonly workspaces: ReadonlyArray<Pick<Workspace, 'id'>>;
  readonly projects: ReadonlyArray<MobileCreateProject>;
  readonly integrations: ReadonlyArray<Pick<IntegrationBinding, 'provider'>>;
  readonly now?: number;
}): CreateSessionGate => {
  const { workspaceId, provider, projectId, projects, workspaces, integrations } = args;
  const now = args.now ?? Date.now();

  if (typeof workspaceId !== 'string' || workspaceId.length === 0) {
    return { ok: false, reason: 'missing workspaceId' };
  }
  if (!isCreateSessionProvider(provider)) {
    return { ok: false, reason: `unsupported provider: ${String(provider)}` };
  }
  const known = workspaces.some((w) => w.id === workspaceId);
  if (!known) {
    return { ok: false, reason: `unknown workspace: ${workspaceId}` };
  }
  const connected = integrations.some((i) => i.provider === provider);
  if (!connected) {
    return { ok: false, reason: `${provider} is not connected for this workspace` };
  }
  const choice = chooseMobileProject({ projects, projectId });
  if (!choice.ok) {
    return { ok: false, reason: choice.reason };
  }
  if (isRateLimited(now)) {
    return { ok: false, reason: 'too many session launches: slow down and retry shortly' };
  }
  const reservation = reserveSlot();
  if (!reservation) {
    return { ok: false, reason: 'too many session launches: slow down and retry shortly' };
  }
  return {
    ok: true,
    workspaceId: workspaceId as WorkspaceId,
    projectId: choice.projectId,
    provider,
    reservation,
  };
};

export type SpawnWorkflowGate =
  | {
      readonly ok: true;
      readonly sessionId: SessionId;
      readonly workflowId: WorkflowId;
    }
  | { readonly ok: false; readonly reason: string };

export const evaluateMobileSpawnWorkflow = (args: {
  readonly sessionId: unknown;
  readonly workflowId: unknown;
  readonly sessions: ReadonlyArray<{ readonly id: SessionId; readonly workspaceId: WorkspaceId }>;
  readonly workflowsForWorkspace: ReadonlyArray<Pick<Workflow, 'id'>>;
}): SpawnWorkflowGate => {
  const { sessionId, workflowId, sessions, workflowsForWorkspace } = args;

  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    return { ok: false, reason: 'missing sessionId' };
  }
  if (typeof workflowId !== 'string' || workflowId.length === 0) {
    return { ok: false, reason: 'missing workflowId' };
  }
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) {
    return { ok: false, reason: `unknown session: ${sessionId}` };
  }
  const known = workflowsForWorkspace.some((w) => w.id === workflowId);
  if (!known) {
    return { ok: false, reason: `unknown workflow for this session: ${workflowId}` };
  }
  return { ok: true, sessionId: sessionId as SessionId, workflowId: workflowId as WorkflowId };
};
