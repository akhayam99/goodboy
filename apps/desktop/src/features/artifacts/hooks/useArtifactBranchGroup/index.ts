import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { Agent, AgentId, MountId, SessionId } from '@goodboy/types';
import type { MountRowView } from '../../../../store/slices/project-mounts/mountRowModel';
import {
  EMPTY_ARRAY,
  useAppStore,
  useIsSessionCollectionLoaded,
  useSessionOpenQuestions,
  useSessionPlans,
} from '../../../../store';
import { branchGroupKeyOfMount } from '../../../session/branchGroupsOf';
import { artifactBranchCountOf, artifactNeedsYouRowsOf } from '../../artifactBranchRowKeys';
import { artifactRowAgentIdOf } from '../../artifactRowAgentIdOf';
import { groupArtifactRowsByBranch, type ArtifactBranchGroup } from '../../artifactListRows';
import { useArtifactBranchItems } from '../useArtifactBranchItems';
import { useArtifactGenerationList } from '../useArtifactGenerationList';
import { useArtifactRows } from '../useArtifactRows';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
};

export type ArtifactBranchWork = Readonly<{
  group: ArtifactBranchGroup | null;
  mounts: ReadonlyArray<MountRowView>;
  count: number;
  needsYouAgentIds: ReadonlyArray<AgentId | null>;
  isLoaded: boolean;
  error: string | null;
  reload: () => void;
}>;

const NO_AGENTS: ReadonlyArray<Agent> = [];

type PlansError = Readonly<{
  sessionId: SessionId;
  message: string;
}>;

export const useArtifactBranchGroup = ({ sessionId, mountId }: Params): ArtifactBranchWork => {
  const artifacts = useAppStore((s) => s.sessionArtifacts[sessionId] ?? EMPTY_ARRAY);
  const hasArtifacts = useAppStore((s) => s.sessionArtifacts[sessionId] !== undefined);
  const error = useAppStore((s) => s.artifactLoadErrors?.[sessionId] ?? null);
  const loadSessionArtifacts = useAppStore((s) => s.loadSessionArtifacts);
  const agents = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? NO_AGENTS);
  const plans = useSessionPlans(sessionId);
  const hasPlans = useIsSessionCollectionLoaded({ sessionId, collection: 'plans' });
  const openQuestions = useSessionOpenQuestions(sessionId);
  const generations = useArtifactGenerationList({ agents, artifacts, openQuestions });
  const rows = useArtifactRows({ sessionId, generations });
  const items = useArtifactBranchItems({ sessionId, rows, plans, artifacts, agents });

  const loadSessionPlans = useAppStore((s) => s.loadSessionPlans);
  const [plansError, setPlansError] = useState<PlansError | null>(null);
  const plansMessage = plansError?.sessionId === sessionId ? plansError.message : null;

  const loadPlans = useCallback(() => {
    setPlansError(null);
    loadSessionPlans(sessionId).catch((cause: unknown) =>
      setPlansError({ sessionId, message: formatError(cause) }),
    );
  }, [loadSessionPlans, sessionId]);

  useEffect(() => {
    if (hasArtifacts || error !== null) {
      return;
    }
    void loadSessionArtifacts(sessionId);
  }, [error, hasArtifacts, loadSessionArtifacts, sessionId]);

  useEffect(() => {
    if (hasPlans) {
      return;
    }
    loadPlans();
  }, [hasPlans, loadPlans]);

  const group = useMemo(() => {
    if (mountId === null) {
      return null;
    }
    const key = branchGroupKeyOfMount({ mountId, mounts: items.mounts });
    const view = groupArtifactRowsByBranch({ items: items.items, mounts: items.mounts });
    return view.groups.find((candidate) => candidate.key === key) ?? null;
  }, [items.items, items.mounts, mountId]);

  const groupRows = useMemo(() => group?.items.map((item) => item.row) ?? [], [group]);
  const needsYouAgentIds = useMemo(
    () =>
      artifactNeedsYouRowsOf({ rows: groupRows }).map((row) =>
        artifactRowAgentIdOf({ row, plans, artifacts }),
      ),
    [artifacts, groupRows, plans],
  );

  return {
    group,
    mounts: items.mounts,
    count: artifactBranchCountOf({ rows: groupRows }),
    needsYouAgentIds,
    isLoaded: hasArtifacts && hasPlans && items.isSettled,
    error: error ?? plansMessage,
    reload: () => {
      void loadSessionArtifacts(sessionId);
      if (!hasPlans) {
        loadPlans();
      }
    },
  };
};
