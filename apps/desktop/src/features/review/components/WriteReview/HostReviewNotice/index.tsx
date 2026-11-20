import { REVIEW_SOURCE_LABEL } from '@goodboy/core/review-source';
import { Button, ICON_SIZE } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { hostIconOf } from '../../../../../shared/components/hostIconOf';
import { openLink } from '../../../../open/openLink';

type Props = {
  readonly sessionId: SessionId;
  readonly url: string | null;
};

const HOST = REVIEW_SOURCE_LABEL.bitbucket;
const HostIcon = hostIconOf({ host: 'bitbucket' });

export const HostReviewNotice = ({ sessionId, url }: Props) => (
  <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
    <p className="text-meta text-muted-foreground">{`${HOST} reviews are written on ${HOST}.`}</p>
    {url === null ? null : (
      <Button size="sm" variant="secondary" onClick={() => openLink({ url, sessionId })}>
        <HostIcon size={ICON_SIZE.row} aria-hidden />
        {`Open on ${HOST}`}
      </Button>
    )}
  </div>
);
