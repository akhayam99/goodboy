import type { Agent, MountId, SessionMountView } from '@goodboy/types';
import type { AutoTreeView } from '../../store/slices/auto-view/state';
import { delegationMountIdOf } from '../auto/delegationMountIdOf';

type Params = {
  readonly agents: ReadonlyArray<Agent>;
  readonly autoViews: ReadonlyArray<AutoTreeView>;
  readonly mounts: ReadonlyArray<SessionMountView>;
};

type KnownParams = {
  readonly value: string | null;
  readonly mounts: ReadonlyArray<SessionMountView>;
};

const knownMountIdOf = ({ value, mounts }: KnownParams): MountId | null =>
  value === null ? null : (mounts.find((mount) => mount.id === value)?.id ?? null);

export const leadMountAgentsOf = ({ agents, autoViews, mounts }: Params): ReadonlyArray<Agent> => {
  if (autoViews.length === 0 || !agents.some((agent) => agent.mountId == null)) {
    return agents;
  }
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
  return agents.map((agent) => {
    const mountId = agent.mountId == null ? leadMounts.get(agent.id) : undefined;
    return mountId === undefined ? agent : { ...agent, mountId };
  });
};
