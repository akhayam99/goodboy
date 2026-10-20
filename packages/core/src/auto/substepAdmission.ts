import type { AutoTree } from '@goodboy/db';
import { AUTO_SUBSTEPS_PER_PARENT, AUTO_TREE_DEPTH } from './limits';
import type { AutoRefusalCode } from './refusals';
import type { AutoDelegationRole } from './roles';
import { isAutoSubstepRole } from './substep';

export type AdmissionSubstep = Readonly<{
  parentDelegationId: string;
  questionId: string;
}>;

export type AdmissionParentFacts = Readonly<{
  delegationId: string;
  state: string;
  generation: number;
  pausedQuestionId: string | null;
  depth: number;
  substeps: number;
}>;

type SubstepRefusalParams = {
  readonly tree: AutoTree;
  readonly role: AutoDelegationRole;
  readonly substep: AdmissionSubstep;
  readonly parents: ReadonlyArray<AdmissionParentFacts>;
  readonly seenInBatch: number;
};

export const substepRefusal = ({
  tree,
  role,
  substep,
  parents,
  seenInBatch,
}: SubstepRefusalParams): AutoRefusalCode | null => {
  const parent = parents.find((facts) => facts.delegationId === substep.parentDelegationId);
  if (parent === undefined) {
    return 'not_paused';
  }
  if (!isAutoSubstepRole({ role })) {
    return 'role_mismatch';
  }
  if (parent.depth + 1 > AUTO_TREE_DEPTH) {
    return 'depth_cap';
  }
  if (parent.generation !== tree.generation) {
    return 'generation_changed';
  }
  const isPausedOnIt = parent.state === 'paused' && parent.pausedQuestionId === substep.questionId;
  if (!isPausedOnIt) {
    return 'not_paused';
  }
  if (parent.substeps + seenInBatch >= AUTO_SUBSTEPS_PER_PARENT) {
    return 'substep_cap';
  }
  return null;
};
