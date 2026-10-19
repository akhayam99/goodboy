import { useEffect, useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { BranchFacts } from '../branchFactsOf';
import { branchDetailOf, needsBranchDetail } from '../branchDetailOf';
import type { BranchDetailWords } from '../branchStoryOf';

type Params = {
  readonly sessionId: SessionId;
  readonly facts: ReadonlyArray<BranchFacts>;
};

export const useBranchDetails = ({
  sessionId,
  facts,
}: Params): ReadonlyMap<string, BranchDetailWords> => {
  const mountGithub = useAppStore((state) => state.mountGithub);
  const refreshSessionPrDetail = useAppStore((state) => state.refreshSessionPrDetail);
  const stuck = useMemo(
    () =>
      facts.filter(
        (fact) => mountGithub?.[fact.mountId]?.pr != null && needsBranchDetail({ fact }),
      ),
    [facts, mountGithub],
  );
  useEffect(() => {
    for (const fact of stuck) {
      void refreshSessionPrDetail(sessionId, { mountId: fact.mountId, silent: true });
    }
  }, [refreshSessionPrDetail, sessionId, stuck]);
  return useMemo(() => {
    const words = new Map<string, BranchDetailWords>();
    for (const fact of stuck) {
      const detail = branchDetailOf({ fact, detail: mountGithub?.[fact.mountId]?.detail });
      if (detail !== null) {
        words.set(fact.mountId, detail);
      }
    }
    return words;
  }, [mountGithub, stuck]);
};
