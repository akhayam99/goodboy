import { Button } from '@goodboy/ui';
import type { CommentThread } from '../../comment-threads';
import { ReviewThreadContent } from '../../../review/components/ReviewThreadContent';

type Props = {
  readonly thread: CommentThread;
  readonly onOpenUrl: (url: string) => void;
  readonly onFix?: () => void;
};

export const OpenThread = ({ thread, onOpenUrl, onFix }: Props) => (
  <div className="flex flex-col gap-1.5 rounded-lg border border-border-soft bg-muted/10 p-3">
    <ReviewThreadContent thread={thread} onOpenUrl={onOpenUrl} />
    {onFix !== undefined && (
      <span className="flex justify-end">
        <Button size="sm" variant="ghost" onClick={onFix}>
          Fix
        </Button>
      </span>
    )}
  </div>
);
