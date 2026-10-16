import { isUserPayload } from '@goodboy/core';
import type { AutoOutboxRow } from '@goodboy/db';
import type { MessageAttachment } from '@goodboy/types';

type Params = {
  readonly rows: ReadonlyArray<Pick<AutoOutboxRow, 'payload'>>;
};

const isImage = (value: unknown): value is MessageAttachment =>
  typeof value === 'object' &&
  value !== null &&
  'kind' in value &&
  value.kind === 'image' &&
  'id' in value &&
  typeof value.id === 'string' &&
  'relPath' in value &&
  typeof value.relPath === 'string';

export const userImagesOf = ({ rows }: Params): ReadonlyArray<MessageAttachment> => {
  const seen = new Set<string>();
  const images: MessageAttachment[] = [];
  for (const row of rows) {
    if (!isUserPayload(row.payload)) {
      continue;
    }
    for (const image of row.payload.images ?? []) {
      if (!isImage(image) || seen.has(image.id)) {
        continue;
      }
      seen.add(image.id);
      images.push(image);
    }
  }
  return images;
};
