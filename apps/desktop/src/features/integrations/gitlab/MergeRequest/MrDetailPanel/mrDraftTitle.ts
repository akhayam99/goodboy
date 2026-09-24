const DRAFT_PREFIX = /^\s*(?:\[(?:draft|wip)\]|\((?:draft|wip)\)|(?:draft|wip)(?=\s|:))\s*:?\s*/i;

type StripParams = {
  readonly title: string;
};

type Params = {
  readonly title: string;
  readonly isDraft: boolean;
};

export const stripDraftPrefix = ({ title }: StripParams): string =>
  title.replace(DRAFT_PREFIX, '').trim();

export const mrDraftTitle = ({ title, isDraft }: Params): string => {
  const bare = stripDraftPrefix({ title });
  if (!isDraft) {
    return bare;
  }
  return bare === '' ? 'Draft:' : `Draft: ${bare}`;
};
