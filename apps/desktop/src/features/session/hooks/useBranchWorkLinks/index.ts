import type { MountId, Session } from '@goodboy/types';
import type { BranchWorkLink } from '../../branchWorkLinkOf';
import { useBranchQuestionLink } from '../useBranchQuestionLink';
import { useBranchRunLink } from '../useBranchRunLink';

type Params = {
  readonly session: Session;
  readonly mountId: MountId | null;
};

export type BranchWorkLinks = Readonly<{
  runs: BranchWorkLink | null;
  questions: BranchWorkLink | null;
}>;

export const useBranchWorkLinks = ({ session, mountId }: Params): BranchWorkLinks => ({
  runs: useBranchRunLink({ session, mountId }),
  questions: useBranchQuestionLink({ session, mountId }),
});
