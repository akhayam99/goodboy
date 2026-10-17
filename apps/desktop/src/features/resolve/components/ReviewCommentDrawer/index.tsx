import type { ComponentProps } from 'react';
import { MessageSquare } from 'lucide-react';
import { DrawerFrame } from '@goodboy/ui';
import type { ReviewEntry } from '../ReviewFlow/useReviewEntries';
import { CommentDrawerFrame } from './CommentDrawerFrame';
import { REVIEW_COMMENT_DRAWER_COPY } from './reviewCommentDrawerCopy';

type Props = Omit<ComponentProps<typeof CommentDrawerFrame>, 'entry'> & {
  readonly entry: ReviewEntry | null;
};

export const ReviewCommentDrawer = ({ entry, ...frame }: Props) => {
  if (entry === null) {
    return (
      <DrawerFrame
        title={REVIEW_COMMENT_DRAWER_COPY.fallbackTitle}
        icon={MessageSquare}
        onClose={frame.onClose}
      >
        <p className="text-body text-muted-foreground">{REVIEW_COMMENT_DRAWER_COPY.gone}</p>
      </DrawerFrame>
    );
  }
  return <CommentDrawerFrame entry={entry} {...frame} />;
};
