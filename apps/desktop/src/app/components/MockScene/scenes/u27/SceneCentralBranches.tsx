import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { BranchList } from '../../../../../features/session/central/branches/BranchList';
import { branchEntriesOf } from '../../../../../features/session/central/branches/branchStoryOf';
import { useBranchFacts } from '../../../../../features/session/central/branches/useBranchFacts';
import type { LiveGroupModel } from '../../../../../features/session/central/now/liveGroupsOf';

const NO_GROUPS: ReadonlyArray<LiveGroupModel> = [];

const NO_ORDER: ReadonlyMap<string, number> = new Map();

type Props = {
  readonly sessionId: SessionId;
};

export const SceneCentralBranches = ({ sessionId }: Props) => {
  const { facts } = useBranchFacts({ sessionId, groups: NO_GROUPS });
  const entries = useMemo(
    () => branchEntriesOf({ facts, cardOrderByMountId: NO_ORDER, detailByMountId: new Map() }),
    [facts],
  );
  return <BranchList sessionId={sessionId} entries={entries} />;
};
