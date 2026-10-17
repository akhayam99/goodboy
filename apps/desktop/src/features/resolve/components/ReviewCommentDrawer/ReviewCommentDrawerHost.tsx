import { useCallback, useRef } from 'react';
import { reviewCommentDrawerSlot } from '../../reviewCommentDrawerSlot';

export const ReviewCommentDrawerHost = () => {
  const hostRef = useRef<HTMLElement | null>(null);
  const attachHost = useCallback((node: HTMLDivElement | null) => {
    if (node === null) {
      if (hostRef.current !== null) {
        reviewCommentDrawerSlot.detach({ host: hostRef.current });
      }
      hostRef.current = null;
      return;
    }
    hostRef.current = node;
    reviewCommentDrawerSlot.attach({ host: node });
  }, []);
  return (
    <div
      ref={attachHost}
      data-slot="review-comment-drawer"
      className="flex h-full min-h-0 min-w-0 flex-col"
    />
  );
};
