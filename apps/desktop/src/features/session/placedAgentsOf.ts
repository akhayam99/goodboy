import type { Agent, MountId, SessionMountView } from '@goodboy/types';
import type { AutoTreeView } from '../../store/slices/auto-view/state';
import { delegationMountIdOf } from '../auto/delegationMountIdOf';
import { NO_TOUCHED_MOUNT_IDS, type TouchedMountIds } from './touchedMountIdsOf';
import { soleMountIdOf } from './soleMountIdOf';

type Params = {
  readonly agents: ReadonlyArray<Agent>;
  readonly autoViews: ReadonlyArray<AutoTreeView>;
  readonly mounts: ReadonlyArray<SessionMountView>;
  readonly touchedMountIds?: TouchedMountIds;
};

type KnownParams = {
  readonly value: string | null;
  readonly mounts: ReadonlyArray<SessionMountView>;
};

const knownMountIdOf = ({ value, mounts }: KnownParams): MountId | null =>
  value === null ? null : (mounts.find((mount) => mount.id === value)?.id ?? null);

type LeadParams = {
  readonly autoViews: ReadonlyArray<AutoTreeView>;
  readonly mounts: ReadonlyArray<SessionMountView>;
};

const leadMountsOf = ({ autoViews, mounts }: LeadParams): ReadonlyMap<string, MountId> => {
  const leadMounts = new Map<string, MountId>();
  for (const view of autoViews) {
    const root = knownMountIdOf({ value: view.tree.primaryMountId, mounts });
    if (root !== null) {
      leadMounts.set(view.tree.rootAgentId, root);
    }
    for (const delegation of view.delegations) {
      const child = knownMountIdOf({ value: delegationMountIdOf({ delegation }), mounts });
      if (child !== null) {
        leadMounts.set(delegation.childAgentId, child);
      }
    }
  }
  return leadMounts;
};

export const placedAgentsOf = ({
  agents,
  autoViews,
  mounts,
  touchedMountIds = NO_TOUCHED_MOUNT_IDS,
}: Params): ReadonlyArray<Agent> => {
  if (!agents.some((agent) => agent.mountId == null)) {
    return agents;
  }
  const leadMounts = leadMountsOf({ autoViews, mounts });
  const soleMountId = soleMountIdOf({ mounts });
  return agents.map((agent) => {
    if (agent.mountId != null) {
      return agent;
    }
    const touched = (touchedMountIds.get(agent.id) ?? []).find(
      (candidate) => knownMountIdOf({ value: candidate, mounts }) !== null,
    );
    const mountId = leadMounts.get(agent.id) ?? touched ?? soleMountId;
    return mountId === null ? agent : { ...agent, mountId };
  });
};
