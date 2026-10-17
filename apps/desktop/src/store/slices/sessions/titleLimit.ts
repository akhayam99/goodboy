import { SESSION_TITLE_MAX_LENGTH } from '@goodboy/types';

const ELLIPSIS = '…';

export const clampTitle = (s: string) => {
  const title = s.trim();
  if (title.length <= SESSION_TITLE_MAX_LENGTH) {
    return title;
  }
  const room = SESSION_TITLE_MAX_LENGTH - ELLIPSIS.length;
  const lastSpace = title.lastIndexOf(' ', room);
  const cut = title.slice(0, lastSpace > SESSION_TITLE_MAX_LENGTH / 2 ? lastSpace : room);
  return `${cut.trimEnd()}${ELLIPSIS}`;
};
