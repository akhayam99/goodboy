import type { ResolvePublicationPreview } from '@goodboy/types';

export const closingThreadCount = ({
  preview,
}: {
  readonly preview: ResolvePublicationPreview;
}): number => preview.replies.filter((reply) => reply.closes).length + preview.notes.length;
