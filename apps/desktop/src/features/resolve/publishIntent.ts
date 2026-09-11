import type { ResolvePublicationPreview } from '@goodboy/types';

export type ResolvePublishIntent = 'publish_fix' | 'close_without_fix' | 'post_replies';

export const publishIntent = ({
  preview,
}: {
  readonly preview: ResolvePublicationPreview;
}): ResolvePublishIntent => {
  if (preview.requiresPush) {
    return 'publish_fix';
  }
  const closes = preview.replies.some((reply) => reply.closes);
  return closes ? 'close_without_fix' : 'post_replies';
};

export const isPublishIntentGuarded = ({
  intent,
}: {
  readonly intent: ResolvePublishIntent;
}): boolean => intent === 'close_without_fix';
