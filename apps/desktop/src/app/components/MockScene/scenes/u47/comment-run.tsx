import type { ComponentType } from 'react';
import { THREAD_IDS } from '../resolveSeed';
import { CommentRunComposeScene } from './CommentRunComposeScene';
import { CommentRunPageScene } from './CommentRunPageScene';
import { CommentRunWorkingScene } from './CommentRunWorkingScene';

const ONE_COMMENT: ReadonlyArray<string> = [];
const TWO_COMMENTS: ReadonlyArray<string> = [THREAD_IDS.retryConstant];

export const U47_COMMENT_RUN_SCENES = {
  'u47-comment-run-compose': () => <CommentRunComposeScene extraThreadIds={TWO_COMMENTS} />,
  'u47-comment-run-compose-one': () => <CommentRunComposeScene extraThreadIds={ONE_COMMENT} />,
  'u47-comment-run-working': () => <CommentRunWorkingScene />,
  'u47-comment-run-working-page': () => <CommentRunPageScene theme="dark" />,
} satisfies Readonly<Record<string, ComponentType>>;
