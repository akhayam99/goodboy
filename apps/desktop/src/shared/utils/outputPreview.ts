import { stripControlMarkers } from '@goodboy/core';

type Params = {
  readonly text: string | null | undefined;
};

export const outputPreview = ({ text }: Params): string => {
  if (text == null) {
    return '';
  }
  return stripControlMarkers(text).replace(/\s+/g, ' ').trim();
};
