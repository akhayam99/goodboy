import type { MessageAttachment } from '@goodboy/types';
import { isRecord } from '@goodboy/types/helpers';

type Params = {
  readonly snapshot: unknown;
};

export const launchImagesOf = ({ snapshot }: Params): ReadonlyArray<MessageAttachment> | null => {
  if (!isRecord(snapshot) || !Array.isArray(snapshot['images'])) {
    return null;
  }
  const images: Array<MessageAttachment> = [];
  for (const value of snapshot['images']) {
    if (!isRecord(value) || value['kind'] !== 'image') {
      continue;
    }
    const { id, fileName, mimeType, relPath, dir } = value;
    if (
      typeof id !== 'string' ||
      typeof fileName !== 'string' ||
      typeof mimeType !== 'string' ||
      typeof relPath !== 'string'
    ) {
      continue;
    }
    images.push({
      id,
      kind: 'image',
      fileName,
      mimeType,
      relPath,
      ...(typeof dir === 'string' ? { dir } : {}),
    });
  }
  return images;
};
