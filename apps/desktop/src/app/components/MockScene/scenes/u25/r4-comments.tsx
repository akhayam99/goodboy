import { R4CommentsScene } from './r4CommentsScene';

export const U25_R4_COMMENTS_SCENES = {
  'r4-comments-list': () => <R4CommentsScene variant="list" />,
  'r4-comments-drawer': () => <R4CommentsScene variant="open" />,
  'r4-comments-drawer-ready': () => <R4CommentsScene variant="ready" />,
  'r4-comments-drawer-failed': () => <R4CommentsScene variant="failed" />,
};
