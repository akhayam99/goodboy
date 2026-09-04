import type { AgentId, Project, SessionId } from '@goodboy/types';
import type { GetFn } from './slice-types';

export const IMMEDIATE_MATERIALIZE_CAP = 2;

export type MaterializationGate = 'mounted' | 'allowed' | 'deferred';

type GoalNamesProjectParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly projectName: string;
};

const goalNamesProject = ({ get, sessionId, projectName }: GoalNamesProjectParams): boolean => {
  const needle = projectName.toLowerCase();
  if (needle === '') {
    return false;
  }
  const session = get().sessions.find((candidate) => candidate.id === sessionId);
  const goalSlot = (get().sessionSlots[sessionId] ?? []).find((slot) => slot.key === 'goal');
  const tasks = get().sessionExternalTasks[sessionId] ?? [];
  const haystacks = [
    session?.goal ?? '',
    goalSlot?.value ?? '',
    ...tasks.flatMap((task) => [task.title, task.identifier]),
  ];
  return haystacks.some((text) => text.toLowerCase().includes(needle));
};

type GateParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly project: Project;
  readonly immediateCount: number;
};

export const materializationGate = ({
  get,
  sessionId,
  project,
  immediateCount,
}: GateParams): MaterializationGate => {
  const mounts = get().sessionProjectMounts[sessionId] ?? [];
  if (mounts.some((mount) => mount.projectId === project.id)) {
    return 'mounted';
  }
  const isNamedByGoal = goalNamesProject({ get, sessionId, projectName: project.name });
  const isAllowedNow =
    (mounts.length === 0 || isNamedByGoal) && immediateCount < IMMEDIATE_MATERIALIZE_CAP;
  return isAllowedNow ? 'allowed' : 'deferred';
};

type ProposeParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly project: Project;
  readonly reason: string;
  readonly agentId: AgentId | null;
};

export const proposeMaterialization = async ({
  get,
  sessionId,
  project,
  reason,
  agentId,
}: ProposeParams): Promise<void> => {
  await get().recordSessionEvent({
    sessionId,
    kind: 'project_materialization_proposed',
    payload: {
      projectId: project.id,
      projectName: project.name,
      reason,
      ...(agentId == null ? {} : { agentId }),
    },
  });
};

export const deferredMaterializeMessage = ({
  projectName,
}: {
  readonly projectName: string;
}): string =>
  `materialize deferred: mounting ${projectName} needs the owner's approval (reason recorded). Continue with the mounted projects or end your turn.`;
