import { useEffect, useMemo } from 'react';
import { brandId, type MountId, type SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { useSessionMountHosts } from '../../../../../shared/hooks/useSessionMountHosts';
import type { BranchFacts } from '../branchFactsOf';
import { branchDetailOf, needsBranchDetail } from '../branchDetailOf';
import type { BranchDetailWords } from '../branchStoryOf';

type Params = {
  readonly sessionId: SessionId;
  readonly facts: ReadonlyArray<BranchFacts>;
};

const KEY_SEPARATOR = '\n';

const FIELD_SEPARATOR = ' ';

export const useBranchDetails = ({
  sessionId,
  facts,
}: Params): ReadonlyMap<string, BranchDetailWords> => {
  const { mountGithub } = useSessionMountHosts({ sessionId });
  const refreshSessionPrDetail = useAppStore((state) => state.refreshSessionPrDetail);
  const stuck = useMemo(
    () =>
      facts.filter(
        (fact) => mountGithub?.[fact.mountId]?.pr != null && needsBranchDetail({ fact }),
      ),
    [facts, mountGithub],
  );
  const stuckKey = stuck
    .map((fact) => {
      const github = mountGithub?.[fact.mountId];
      return [fact.mountId, github?.pr?.number ?? '', github?.fetchedAt ?? ''].join(
        FIELD_SEPARATOR,
      );
    })
    .join(KEY_SEPARATOR);
  useEffect(() => {
    if (stuckKey === '') {
      return;
    }
    for (const entry of stuckKey.split(KEY_SEPARATOR)) {
      const [mountId = ''] = entry.split(FIELD_SEPARATOR);
      void refreshSessionPrDetail(sessionId, {
        mountId: brandId<MountId>({ value: mountId }),
        silent: true,
      });
    }
  }, [refreshSessionPrDetail, sessionId, stuckKey]);
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
