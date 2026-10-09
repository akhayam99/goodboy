import { ExternalLink } from 'lucide-react';
import { Button, EmptyState } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { openUrl } from '../../../../shared/lib/editor';

type Props = {
  readonly url: string | null;
};

export const BitbucketNoPullRequest = ({ url }: Props) => (
  <EmptyState
    size="page"
    icon={CONCEPT_ICONS.pr}
    title="No pull request yet"
    description="Create the pull request on Bitbucket, it appears here"
    action={
      url === null ? undefined : (
        <Button variant="secondary" size="sm" onClick={() => void openUrl(url)}>
          Open Bitbucket
          <ExternalLink size={ICON_SIZE.row} aria-hidden />
        </Button>
      )
    }
  />
);
