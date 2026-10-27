import { SquareArrowOutUpRight } from 'lucide-react';
import { Button, EmptyState, ICON_SIZE } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { openUrl } from '../../../../shared/lib/editor';

type Props = {
  readonly url: string | null;
  readonly isConnected: boolean;
};

export const BitbucketNoPullRequest = ({ url, isConnected }: Props) => (
  <EmptyState
    size="page"
    icon={CONCEPT_ICONS.pr}
    title="No pull request yet"
    description={
      isConnected
        ? 'Create the pull request on Bitbucket and Goodboy follows it'
        : 'Create the pull request on Bitbucket. Connect Bitbucket in Settings to follow it'
    }
    action={
      url === null ? undefined : (
        <Button variant="secondary" size="sm" onClick={() => void openUrl(url)}>
          Open Bitbucket
          <SquareArrowOutUpRight size={ICON_SIZE.row} aria-hidden />
        </Button>
      )
    }
  />
);
