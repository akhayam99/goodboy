import { EmptyState } from '@goodboy/ui';
import { GithubIcon } from '../../../shared/components/brand-icons';

type Props = {
  readonly compact?: boolean;
};

export const MissingGithubRemoteEmptyState = ({ compact = false }: Props) => (
  <EmptyState
    icon={GithubIcon}
    title="No GitHub remote"
    description="This workspace does not have a GitHub remote."
    className={compact ? 'py-5' : undefined}
  />
);
