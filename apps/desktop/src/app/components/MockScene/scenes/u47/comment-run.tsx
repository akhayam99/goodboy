import type { ComponentType } from 'react';
import { THREAD_IDS } from '../resolveSeed';
import { CommentRunComposeScene } from './CommentRunComposeScene';
import { CommentRunSuggestScene } from './CommentRunSuggestScene';

const ONE_COMMENT: ReadonlyArray<string> = [];
const TWO_COMMENTS: ReadonlyArray<string> = [THREAD_IDS.retryConstant];

export const U47_COMMENT_RUN_SCENES = {
  'u47-comment-run-compose': () => <CommentRunComposeScene extraThreadIds={TWO_COMMENTS} />,
  'u47-comment-run-compose-one': () => <CommentRunComposeScene extraThreadIds={ONE_COMMENT} />,
  'u47-comment-run-suggest': () => <CommentRunSuggestScene />,
} satisfies Readonly<Record<string, ComponentType>>;
