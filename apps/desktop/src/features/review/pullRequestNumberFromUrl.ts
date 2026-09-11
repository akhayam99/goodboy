type Params = {
  readonly url: string;
};

const PULL_REQUEST_PATH = /\/pull\/(\d+)(?:[/?#]|$)/;

export const pullRequestNumberFromUrl = ({ url }: Params): number | null => {
  const matched = PULL_REQUEST_PATH.exec(url)?.[1] ?? null;
  if (matched === null) {
    return null;
  }
  const parsed = Number.parseInt(matched, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};
