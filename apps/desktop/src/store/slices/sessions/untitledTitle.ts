export const UNTITLED_BASE = 'Untitled session';

const UNTITLED_PATTERN = /^untitled session(?: (\d+))?$/i;

export const untitledSessionTitle = (titles: ReadonlyArray<string>): string => {
  let highest = 0;
  for (const title of titles) {
    const match = UNTITLED_PATTERN.exec(title.trim());
    if (match === null) {
      continue;
    }
    const ordinal = match[1] === undefined ? 1 : Number(match[1]);
    if (ordinal > highest) {
      highest = ordinal;
    }
  }
  return highest === 0 ? UNTITLED_BASE : `${UNTITLED_BASE} ${highest + 1}`;
};
