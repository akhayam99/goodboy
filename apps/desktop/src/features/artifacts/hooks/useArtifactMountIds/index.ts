import { useEffect, useMemo, useRef, useState } from 'react';
import { brandId, type AgentId, type MountId } from '@goodboy/types';
import { loadArtifactProvenance } from '../../artifactProvenance';

type Params = {
  readonly agentIds: ReadonlyArray<AgentId>;
};

type OneParams = {
  readonly agentId: AgentId;
};

type MountIdsByAgentId = ReadonlyMap<AgentId, ReadonlyArray<MountId>>;

const NONE: MountIdsByAgentId = new Map();

const mountIdsOf = async ({ agentId }: OneParams): Promise<ReadonlyArray<MountId>> => {
  try {
    const provenance = await loadArtifactProvenance(agentId);
    return provenance?.mountIds ?? [];
  } catch {
    return [];
  }
};

export const useArtifactMountIds = ({ agentIds }: Params): MountIdsByAgentId => {
  const [loaded, setLoaded] = useState<MountIdsByAgentId>(NONE);
  const requested = useRef<ReadonlySet<AgentId>>(new Set());
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
      if (requested.current.has(agentId)) {
        continue;
      }
      requested.current = new Set([...requested.current, agentId]);
      void mountIdsOf({ agentId }).then((mountIds) => {
        if (!isMounted.current) {
          return;
        }
        setLoaded((previous) => new Map([...previous, [agentId, mountIds]]));
      });
    }
  }, [wanted]);

  return loaded;
};
