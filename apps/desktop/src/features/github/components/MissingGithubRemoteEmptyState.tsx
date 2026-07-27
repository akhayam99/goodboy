import { Button, EmptyState } from '@goodboy/ui';
import { GithubIcon } from '../../../shared/components/brand-icons';

type Props = {
  readonly compact?: boolean;
};

export const MissingGithubRemoteEmptyState = ({ compact = false }: Props) => (
  <EmptyState
    icon={GithubIcon}
    title="Connect GitHub"
    description="This workspace does not have a GitHub remote. Add one, or set a workspace token in the GitHub studio."
    className={compact ? 'py-5' : undefined}
    action={
      <Button
        size="sm"
        onClick={() => window.dispatchEvent(new CustomEvent('goodboy:open-github-studio'))}
      >
        Connect
      </Button>
    }
  />
);
