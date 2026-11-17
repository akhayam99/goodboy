import type { ComponentType } from 'react';
import { THREAD_IDS } from '../resolveSeed';
import { CommentRunComposeScene } from './CommentRunComposeScene';
import { CommentRunPageScene } from './CommentRunPageScene';
import { CommentRunWorkingScene } from './CommentRunWorkingScene';

const ONE_COMMENT: ReadonlyArray<string> = [];
const TWO_COMMENTS: ReadonlyArray<string> = [THREAD_IDS.retryConstant];
const LEAD_SUMMARY =
  'Made the retry backoff a constant per endpoint in RetryPolicy, with the old value as the default. payments-api keeps its timing.';
const NEW_TEXT =
  'Make the retry backoff a named constant, and keep the jitter the payouts route uses.';

export const U47_COMMENT_RUN_SCENES = {
  'u47-comment-run-compose': () => <CommentRunComposeScene extraThreadIds={TWO_COMMENTS} />,
  'u47-comment-run-compose-one': () => <CommentRunComposeScene extraThreadIds={ONE_COMMENT} />,
  'u47-comment-run-working': () => <CommentRunWorkingScene />,
  'u47-comment-run-working-page': () => <CommentRunPageScene theme="dark" />,
  'u47-comment-run-finished': () => (
    <CommentRunWorkingScene status="completed" outputSummary={LEAD_SUMMARY} />
  ),
  'u47-comment-run-stopped': () => <CommentRunWorkingScene status="stopped" />,
  'u47-comment-run-changed': () => <CommentRunWorkingScene change={NEW_TEXT} />,
} satisfies Readonly<Record<string, ComponentType>>;
