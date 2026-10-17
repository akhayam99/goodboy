import type { MessageAttachment, TurnEvent } from '@goodboy/types';

type Params = {
  readonly events: ReadonlyArray<TurnEvent>;
};

const NO_IMAGES: ReadonlyArray<MessageAttachment> = [];

export const briefImagesOf = ({ events }: Params): ReadonlyArray<MessageAttachment> => {
  const brief = events.find((event) => event.kind === 'user_text');
  if (brief?.kind !== 'user_text') {
    return NO_IMAGES;
  }
  return (brief.attachments ?? NO_IMAGES).filter((attachment) => attachment.kind === 'image');
};
