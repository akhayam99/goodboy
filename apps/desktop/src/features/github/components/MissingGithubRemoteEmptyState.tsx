import { EmptyState } from '@goodboy/ui';
import { GitBranch } from 'lucide-react';

type Props = {
  readonly compact?: boolean;
};

export const MissingGithubRemoteEmptyState = ({ compact = false }: Props) => (
  <EmptyState
    icon={GitBranch}
    title="No GitHub remote"
    description="This workspace does not have a GitHub remote."
    className={compact ? 'py-5' : undefined}
  />
);
