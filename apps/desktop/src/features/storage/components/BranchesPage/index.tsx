import type { BranchScope } from '../../branches/branchScope';
import { BranchesSection } from '../BranchesSection';
import { RecentlyDeletedBranches } from './RecentlyDeletedBranches';

type Props = {
  readonly scope: BranchScope;
};

export const BranchesPage = ({ scope }: Props) => (
  <>
    <BranchesSection scope={scope} />
    <RecentlyDeletedBranches scope={scope} />
  </>
);
