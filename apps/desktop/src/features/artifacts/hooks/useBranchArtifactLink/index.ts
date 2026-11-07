import { useEffect, useMemo } from 'react';
import type { Agent, MountId, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useSessionPlans } from '../../../../store';
import type { BranchWorkLink } from '../../../session/branchWorkLinkOf';
import type { ArtifactGeneration } from '../../artifactCollection';
import { artifactBranchLinkOf } from '../../artifactBranchLinkOf';
import { groupArtifactRowsByBranch } from '../../artifactListRows';
import { useArtifactBranchItems } from '../useArtifactBranchItems';
import { useArtifactRows } from '../useArtifactRows';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
};

const NO_GENERATIONS: ReadonlyArray<ArtifactGeneration> = [];

export const useBranchArtifactLink = ({ sessionId, mountId }: Params): BranchWorkLink | null => {
  const artifacts = useAppStore((s) => s.sessionArtifacts[sessionId] ?? EMPTY_ARRAY);
  const agents = useAppStore(
    (s) => s.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const isLoaded = useAppStore((s) => s.sessionArtifacts[sessionId] !== undefined);
  const loadSessionArtifacts = useAppStore((s) => s.loadSessionArtifacts);
  const plans = useSessionPlans(sessionId);
  const rows = useArtifactRows({ sessionId, generations: NO_GENERATIONS });
  const { items, mounts } = useArtifactBranchItems({ sessionId, rows, plans, artifacts, agents });

  useEffect(() => {
    if (!isLoaded) {
      void loadSessionArtifacts(sessionId);
    }
  }, [isLoaded, loadSessionArtifacts, sessionId]);

  return useMemo(() => {
    if (mountId === null) {
      return null;
    }
    const view = groupArtifactRowsByBranch({ items, mounts });
    return artifactBranchLinkOf({ view, mounts, mountId });
  }, [items, mounts, mountId]);
};
