import { useEffect, useMemo, useRef, useState } from 'react';
import { brandId, type AgentId, type MountId } from '@goodboy/types';
import { loadArtifactProvenance } from '../../artifactProvenance';

type Params = {
  readonly agentIds: ReadonlyArray<AgentId>;
  readonly phaseKey: string;
};

type OneParams = {
  readonly agentId: AgentId;
};

type MountIdsByAgentId = ReadonlyMap<AgentId, ReadonlyArray<MountId>>;

export type ArtifactMountIds = Readonly<{
  mountIdsByAgentId: MountIdsByAgentId;
  isSettled: boolean;
}>;

const NONE: MountIdsByAgentId = new Map();
const NONE_ATTEMPTED: ReadonlySet<AgentId> = new Set();

const mountIdsOf = async ({ agentId }: OneParams): Promise<ReadonlyArray<MountId> | null> => {
  try {
    const provenance = await loadArtifactProvenance(agentId);
    return provenance === null || provenance.mountIds.length === 0 ? null : provenance.mountIds;
  } catch {
    return null;
  }
};

export const useArtifactMountIds = ({ agentIds, phaseKey }: Params): ArtifactMountIds => {
  const [loaded, setLoaded] = useState<MountIdsByAgentId>(NONE);
  const [attempted, setAttempted] = useState<ReadonlySet<AgentId>>(NONE_ATTEMPTED);
  const inFlight = useRef<ReadonlySet<AgentId>>(new Set());
  const found = useRef<ReadonlySet<AgentId>>(new Set());
  const isMounted = useRef(true);
  const wantedKey = useMemo(() => [...new Set(agentIds)].sort().join(','), [agentIds]);
  const wanted = useMemo(
    () =>
      wantedKey === '' ? [] : wantedKey.split(',').map((id) => brandId<AgentId>({ value: id })),
    [wantedKey],
  );

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    for (const agentId of wanted) {
      if (inFlight.current.has(agentId) || found.current.has(agentId)) {
        continue;
      }
      inFlight.current = new Set([...inFlight.current, agentId]);
      void mountIdsOf({ agentId }).then((mountIds) => {
        inFlight.current = new Set([...inFlight.current].filter((id) => id !== agentId));
        if (!isMounted.current) {
          return;
        }
        setAttempted((previous) => new Set([...previous, agentId]));
        if (mountIds === null) {
          return;
        }
        found.current = new Set([...found.current, agentId]);
        setLoaded((previous) => new Map([...previous, [agentId, mountIds]]));
      });
    }
  }, [wanted, phaseKey]);

  return {
    mountIdsByAgentId: loaded,
    isSettled: wanted.every((agentId) => attempted.has(agentId)),
  };
};
