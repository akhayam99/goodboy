import type { ThreadRemoteKind } from '../../../../store/slices/resolve/threadGitState';
import type { ReviewCommentState } from '../../reviewCommentState';
import type { ReplyNoteKind } from './ReplyNote';

type Params = {
  readonly state: ReviewCommentState;
  readonly remote: ThreadRemoteKind | null;
  readonly isPostable: boolean;
  readonly isPublishing: boolean;
  readonly isPushWaiting: boolean;
  readonly isPosted: boolean;
};

export const replyNoteKindOf = ({
  state,
  remote,
  isPostable,
  isPublishing,
  isPushWaiting,
  isPosted,
}: Params): ReplyNoteKind | null => {
  if (!isPostable || remote !== null) {
    return null;
  }
  if (state === 'pushed') {
    return isPosted ? 'posted' : null;
  }
  if (state === 'replied' && isPublishing) {
    return 'posting';
  }
  if (isPosted && (state === 'replied' || state === 'ready' || state === 'edited')) {
    return 'posted';
  }
  if (state !== 'replied') {
    return null;
  }
  return isPushWaiting ? 'bundled' : 'alone';
};
