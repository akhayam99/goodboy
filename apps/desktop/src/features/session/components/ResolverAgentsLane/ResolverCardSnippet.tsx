import type { DiffComment, PrComment } from '@goodboy/types';
import { CommentSnippet } from '../CommentSnippet';
import { diffCommentLocation } from '../../diff-comment-location';
import { prCommentLocation } from '../../pr-comment-location';

type Props = {
  readonly threadComment: PrComment | null;
  readonly diffComment: DiffComment | null;
};

export const ResolverCardSnippet = ({ threadComment, diffComment }: Props) => {
  if (threadComment !== null) {
    return (
      <CommentSnippet
        author={threadComment.author}
        location={prCommentLocation({ comment: threadComment })}
        body={threadComment.body}
      />
    );
  }
  if (diffComment !== null) {
    return (
      <CommentSnippet
        location={diffCommentLocation({ comment: diffComment })}
        body={diffComment.body}
      />
    );
  }
  return null;
};
