export const MAX_SESSION_TITLE_LENGTH = 60;

const ELLIPSIS = '…';

export const clampTitle = (s: string) => {
  const title = s.trim();
  if (title.length <= MAX_SESSION_TITLE_LENGTH) {
    return title;
  }
  const room = MAX_SESSION_TITLE_LENGTH - ELLIPSIS.length;
  const lastSpace = title.lastIndexOf(' ', room);
  const cut = title.slice(0, lastSpace > MAX_SESSION_TITLE_LENGTH / 2 ? lastSpace : room);
  return `${cut.trimEnd()}${ELLIPSIS}`;
};
