import type {
  AgentId,
  MaterializationDeferralCause,
  Project,
  ProjectId,
  ProviderRunId,
  SessionId,
} from '@goodboy/types';
import { pendingMountProposals } from './materializationProposals';
import type { GetFn } from './slice-types';

export const IMMEDIATE_MATERIALIZE_CAP = 2;
export const UNNAMED_FOOTPRINT_CAP = 2;

export type MaterializationDecision =
  | { readonly kind: 'mounted' }
  | { readonly kind: 'allowed' }
  | { readonly kind: 'deferred'; readonly cause: MaterializationDeferralCause };

type AuthorizationParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly project: Project;
};

type SessionAuthorizationParams = Omit<AuthorizationParams, 'project'>;

const explicitlyAuthorizedProjectIds = ({
  get,
  sessionId,
}: SessionAuthorizationParams): ReadonlySet<ProjectId> => {
  const state = get();
  const session = state.sessions.find((candidate) => candidate.id === sessionId);
  const ids = new Set<ProjectId>();
  if (session?.activeProjectId !== undefined) {
    ids.add(session.activeProjectId);
  }
  const selectedProjectId = state.sessionActiveProject[sessionId];
  if (selectedProjectId !== undefined) {
    ids.add(selectedProjectId);
  }
  for (const task of state.sessionExternalTasks[sessionId] ?? []) {
    if (task.projectId !== undefined) {
      ids.add(task.projectId);
    }
  }
  return ids;
};

export const isAuthorizedProject = ({ get, sessionId, project }: AuthorizationParams): boolean => {
  if (explicitlyAuthorizedProjectIds({ get, sessionId }).has(project.id)) {
    return true;
  }
  return (get().sessionProjectMounts[sessionId] ?? []).some(
    (mount) => mount.projectId === project.id,
  );
};

type BatchBudget = {
  readonly immediateProjectIds: Set<ProjectId>;
};

type GateParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly project: Project;
  readonly immediateProjectIds: ReadonlySet<ProjectId>;
};

export const materializationGate = ({
  get,
  sessionId,
  project,
  immediateProjectIds,
}: GateParams): MaterializationDecision => {
  const mounts = get().sessionProjectMounts[sessionId] ?? [];
  if (mounts.some((mount) => mount.projectId === project.id)) {
    return { kind: 'mounted' };
  }
  if (isAuthorizedProject({ get, sessionId, project })) {
    return { kind: 'allowed' };
  }
  if (immediateProjectIds.size >= IMMEDIATE_MATERIALIZE_CAP) {
    return { kind: 'deferred', cause: 'batch' };
  }
  const authorizedIds = explicitlyAuthorizedProjectIds({ get, sessionId });
  const nonAuthorizedIds = new Set<ProjectId>();
  for (const mount of mounts) {
    if (!authorizedIds.has(mount.projectId)) {
      nonAuthorizedIds.add(mount.projectId);
    }
  }
  for (const projectId of immediateProjectIds) {
    if (!authorizedIds.has(projectId)) {
      nonAuthorizedIds.add(projectId);
    }
  }
  return nonAuthorizedIds.size < UNNAMED_FOOTPRINT_CAP
    ? { kind: 'allowed' }
    : { kind: 'deferred', cause: 'scope' };
};

type BatchState = {
  tail: Promise<unknown>;
};

const sessionBatches = new Map<SessionId, BatchState>();
const batchBudgets = new Map<string | symbol, BatchBudget>();

type BatchIdentityParams = {
  readonly sessionId: SessionId;
  readonly batchId: string;
};

const batchKey = ({ sessionId, batchId }: BatchIdentityParams): string => `${sessionId}:${batchId}`;

type BatchRunParams = {
  readonly budget: BatchBudget;
};

type BatchParams<T> = {
  readonly sessionId: SessionId;
  readonly batchId?: string;
  readonly run: (params: BatchRunParams) => Promise<T>;
};

export const runMaterializationBatch = async <T>({
  sessionId,
  batchId,
  run,
}: BatchParams<T>): Promise<T> => {
  const state =
    sessionBatches.get(sessionId) ??
    ({
      tail: Promise.resolve(),
    } satisfies BatchState);
  const normalizedBatchId = batchId?.trim();
  const isEphemeral = normalizedBatchId === undefined || normalizedBatchId === '';
  const key = isEphemeral ? Symbol(sessionId) : batchKey({ sessionId, batchId: normalizedBatchId });
  const budget =
    batchBudgets.get(key) ?? ({ immediateProjectIds: new Set<ProjectId>() } satisfies BatchBudget);
  batchBudgets.set(key, budget);
  sessionBatches.set(sessionId, state);
  const next = state.tail.then(
    () => run({ budget }),
    () => run({ budget }),
  );
  const settled = next.catch(() => undefined);
  state.tail = settled;
  try {
    return await next;
  } finally {
    if (isEphemeral) {
      batchBudgets.delete(key);
    }
    if (sessionBatches.get(sessionId) === state && state.tail === settled) {
      sessionBatches.delete(sessionId);
    }
  }
};

export const clearMaterializationBatch = ({ sessionId, batchId }: BatchIdentityParams): void => {
  batchBudgets.delete(batchKey({ sessionId, batchId }));
};

type ProposeParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly project: Project;
  readonly reason: string;
  readonly cause: MaterializationDeferralCause;
  readonly agentId: AgentId | null;
  readonly turnRunId: ProviderRunId | null;
};

export type MaterializationProposalResult = 'proposed' | 'already-pending';

export const proposeMaterialization = async ({
  get,
  sessionId,
  project,
  reason,
  cause,
  agentId,
  turnRunId,
}: ProposeParams): Promise<MaterializationProposalResult> => {
  if (get().sessionEvents[sessionId] === undefined) {
    await get().loadSessionEvents({ sessionId });
  }
  const events = get().sessionEvents[sessionId] ?? [];
  const isPending = pendingMountProposals({ events }).some(
    (proposal) => proposal.projectId === project.id,
  );
  if (isPending) {
    return 'already-pending';
  }
  await get().recordSessionEvent({
    sessionId,
    kind: 'project_materialization_proposed',
    payload: {
      projectId: project.id,
      projectName: project.name,
      reason,
      deferralCause: cause,
      ...(agentId == null ? {} : { agentId }),
      ...(turnRunId == null ? {} : { turnRunId }),
    },
  });
  return 'proposed';
};

const DEFERRAL_TAIL =
  "A mount suggestion is available in this session's projects section or the requesting agent's conversation.";

type DeferredNoteParams = {
  readonly projectName: string;
  readonly isAlreadyPending?: boolean;
};

export const deferredMaterializeNote = ({
  projectName,
  isAlreadyPending = false,
}: DeferredNoteParams): string =>
  isAlreadyPending
    ? `Mount already pending for ${projectName}. Do not request it again in this session. Continue with work that does not require this mount while the owner decides.`
    : `Mount deferred for ${projectName}.`;

type DeferredMessageParams = {
  readonly projectName: string;
  readonly cause: MaterializationDeferralCause;
  readonly isAlreadyPending?: boolean;
};

export const deferredMaterializeMessage = ({
  projectName,
  cause,
  isAlreadyPending = false,
}: DeferredMessageParams): string => {
  if (isAlreadyPending) {
    return `Mount already pending for ${projectName}. Do not request it again in this session. Continue with work that does not require this mount while the owner decides.`;
  }
  switch (cause) {
    case 'scope':
      return `Mount deferred for ${projectName}: adding an unauthorized project beyond this session's two-project allowance requires approval. ${DEFERRAL_TAIL}`;
    case 'batch':
      return `Mount deferred for ${projectName}: this request has already mounted two projects. ${DEFERRAL_TAIL}`;
    default: {
      const exhaustive: never = cause;
      return exhaustive;
    }
  }
};
