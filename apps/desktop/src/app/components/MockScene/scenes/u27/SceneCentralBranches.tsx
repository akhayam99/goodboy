import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { BranchList } from '../../../../../features/session/central/branches/BranchList';
import { branchEntriesOf } from '../../../../../features/session/central/branches/branchStoryOf';
import { useBranchFacts } from '../../../../../features/session/central/branches/useBranchFacts';
import type { LiveGroupModel } from '../../../../../features/session/central/now/liveGroupsOf';

const NO_GROUPS: ReadonlyArray<LiveGroupModel> = [];

type Props = {
  readonly sessionId: SessionId;
};

export const SceneCentralBranches = ({ sessionId }: Props) => {
  const { facts } = useBranchFacts({ sessionId, groups: NO_GROUPS });
  const entries = useMemo(() => {
    const { live, finished } = branchEntriesOf({ facts, detailByMountId: new Map() });
    return [...live, ...finished];
  }, [facts]);
  return <BranchList sessionId={sessionId} entries={entries} />;
};
