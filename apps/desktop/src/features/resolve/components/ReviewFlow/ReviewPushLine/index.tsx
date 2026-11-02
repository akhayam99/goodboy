import { ArrowUp } from 'lucide-react';
import { Button, ICON_SIZE } from '@goodboy/ui';
import { commitCountText } from '../../../reviewLaunchCopy';

type Props = {
  readonly count: number;
  readonly isBusy: boolean;
  readonly onPush: () => void;
};

export const ReviewPushLine = ({ count, isBusy, onPush }: Props) => {
  if (count === 0) {
    return null;
  }
  return (
    <div
      data-testid="review-push-line"
      className="flex min-w-0 items-center justify-between gap-3 px-3 py-2 text-meta text-muted-foreground"
    >
      <span>{commitCountText({ count })} not pushed</span>
      <Button size="sm" variant="ghost" disabled={isBusy} onClick={onPush}>
        <ArrowUp size={ICON_SIZE.control} aria-hidden />
        Push these
      </Button>
    </div>
  );
};
