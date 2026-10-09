const DRAFT_PREFIX = /^\s*(?:\[(?:draft|wip)\]|\((?:draft|wip)\)|(?:draft|wip)(?=\s|:))\s*:?\s*/i;

export const stripGitlabDraftPrefix = ({ title }: { readonly title: string }): string =>
  title.replace(DRAFT_PREFIX, '').trim();

export const gitlabDraftTitle = ({
  title,
  isDraft,
}: {
  readonly title: string;
  readonly isDraft: boolean;
}): string => {
  const bare = stripGitlabDraftPrefix({ title });
  if (!isDraft) {
    return bare;
  }
  return bare === '' ? 'Draft:' : `Draft: ${bare}`;
};
