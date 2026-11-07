import type { MountId } from '@goodboy/types';
import type { MountRowView } from '../../store/slices/project-mounts/mountRowModel';
import { branchGroupKeyOfMount } from './branchGroupsOf';
import { branchWorkLinkOf, type BranchWorkLink } from './branchWorkLinkOf';
import type { QuestionBranchGroup } from './components/SessionWorkspace/parts/questionsLensModel';

type Params = {
  readonly groups: ReadonlyArray<QuestionBranchGroup>;
  readonly mounts: ReadonlyArray<MountRowView>;
  readonly mountId: MountId;
};

export const questionBranchLinkOf = ({
  groups,
  mounts,
  mountId,
}: Params): BranchWorkLink | null => {
  const groupKey = branchGroupKeyOfMount({ mountId, mounts });
  const group = groups.find((candidate) => candidate.key === groupKey);
  const count = group === undefined ? 0 : group.waiting.length + group.answered.length;
  return branchWorkLinkOf({ groupKey, count, one: 'question', many: 'questions' });
};
