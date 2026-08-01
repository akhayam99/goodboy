import { Button, EmptyState } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';

type Props = {
  readonly compact?: boolean;
};

export const MissingGithubRemoteEmptyState = ({ compact = false }: Props) => (
  <EmptyState
    icon={CONCEPT_ICONS.github}
    title="Connect GitHub"
    description="This workspace does not have a GitHub remote. Add one, or set a workspace token in the GitHub studio."
    size={compact ? 'sm' : 'lg'}
    headingLevel={compact ? undefined : 2}
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
