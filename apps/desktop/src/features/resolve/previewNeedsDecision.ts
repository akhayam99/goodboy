import type { ResolvePublicationPreview } from '@goodboy/types';

type Params = {
  readonly preview: ResolvePublicationPreview;
};

export const previewNeedsDecision = ({ preview }: Params): boolean =>
  preview.blocker !== null ||
  preview.publicationId === null ||
  preview.drift.length > 0 ||
  preview.unapproved.length > 0 ||
  (preview.earlierCommits ?? []).length > 0 ||
  preview.commits.some((commit) => commit.threadIds.length === 0);
