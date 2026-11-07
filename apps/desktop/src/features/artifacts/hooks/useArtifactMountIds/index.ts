import { useEffect, useMemo, useState } from 'react';
import { brandId, type AgentId, type MountId } from '@goodboy/types';
import { loadArtifactProvenance } from '../../artifactProvenance';

type Params = {
  readonly agentIds: ReadonlyArray<AgentId>;
};

type MountIdsByAgentId = ReadonlyMap<AgentId, ReadonlyArray<MountId>>;

const NONE: MountIdsByAgentId = new Map();

type OneParams = {
  readonly agentId: AgentId;
};

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
  const wantedKey = useMemo(() => [...new Set(agentIds)].sort().join(','), [agentIds]);
  const wanted = useMemo(
    () =>
      wantedKey === '' ? [] : wantedKey.split(',').map((id) => brandId<AgentId>({ value: id })),
    [wantedKey],
  );

  useEffect(() => {
    const missing = wanted.filter((agentId) => !loaded.has(agentId));
    if (missing.length === 0) {
      return;
    }
    let isCurrent = true;
    void Promise.all(
      missing.map(async (agentId) => [agentId, await mountIdsOf({ agentId })] as const),
    ).then((entries) => {
      if (!isCurrent) {
        return;
      }
      setLoaded((previous) => new Map([...previous, ...entries]));
    });
    return () => {
      isCurrent = false;
    };
  }, [wanted, loaded]);

  return loaded;
};
