import type { BranchWorkTabRegistration } from '../branch/branchWorkTab';
import { BranchWork } from './components/BranchWork';
import { useBranchWork, type BranchWorkView } from './hooks/useBranchWork';

export const branchWorkTabRegistration = {
  useWork: useBranchWork,
  render: ({ session, work }) => <BranchWork session={session} work={work} />,
} satisfies BranchWorkTabRegistration<BranchWorkView>;
