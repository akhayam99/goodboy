import type { SessionId } from '@goodboy/types';
import { openCommentsLine } from '../../reviewBulkCopy';
import { FixCommentsButton } from '../FixCommentsButton';

type Props = {
  readonly count: number;
  readonly sessionId: SessionId;
};

export const FixOpenLine = ({ count, sessionId }: Props) => (
  <div className="flex min-w-0 flex-wrap items-center gap-3">
    <span className="text-label text-foreground">{openCommentsLine({ count })}</span>
    <FixCommentsButton sessionId={sessionId} mountId={null} />
  </div>
);
