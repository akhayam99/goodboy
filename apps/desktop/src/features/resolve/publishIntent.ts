import type { ResolvePublicationPreview } from '@goodboy/types';
import { closingThreadCount } from './closingThreadCount';

export type ResolvePublishIntent = 'publish_fix' | 'close_without_fix' | 'post_replies';

export const publishIntent = ({
  preview,
}: {
  readonly preview: ResolvePublicationPreview;
}): ResolvePublishIntent => {
  if (preview.requiresPush) {
    return 'publish_fix';
  }
  return closingThreadCount({ preview }) > 0 ? 'close_without_fix' : 'post_replies';
};

export const isPublishIntentGuarded = ({
  intent,
}: {
  readonly intent: ResolvePublishIntent;
}): boolean => intent === 'close_without_fix';
