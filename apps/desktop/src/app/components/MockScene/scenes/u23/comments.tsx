import { CommentsScene } from './CommentsScene';

export const U23_COMMENTS_SCENES = {
  'comments-groups': () => <CommentsScene variant="groups" />,
  'comments-ready-to-push': () => <CommentsScene variant="ready-to-push" />,
  'comments-push-failed': () => <CommentsScene variant="push-failed" />,
  'comments-left-open': () => <CommentsScene variant="left-open" />,
  'comments-action-bar': () => <CommentsScene variant="action-bar" />,
  'comments-working': () => <CommentsScene variant="working" />,
};
