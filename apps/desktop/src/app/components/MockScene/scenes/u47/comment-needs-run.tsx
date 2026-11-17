import type { ComponentType } from 'react';
import { CommentNeedsRunScene } from './CommentNeedsRunScene';

export const U47_COMMENT_NEEDS_RUN_SCENES = {
  'u47-comment-needs-run': () => <CommentNeedsRunScene />,
  'u47-comment-needs-run-light': () => <CommentNeedsRunScene theme="light" />,
  'u47-comment-needs-run-compose': () => <CommentNeedsRunScene isComposing />,
} satisfies Readonly<Record<string, ComponentType>>;
