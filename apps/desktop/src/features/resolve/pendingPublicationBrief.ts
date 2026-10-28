import type { ResolvePublication } from '@goodboy/types';

type Params = {
  readonly publication: ResolvePublication;
};

export const pendingPublicationBrief = ({ publication }: Params): string => {
  const commits = publication.commitShas.length;
  const fixes = commits === 0 ? '' : ` with ${commits} fix ${commits === 1 ? 'commit' : 'commits'}`;
  return `Goodboy was publishing the replies to the review comments of pull request #${publication.prNumber}${fixes}. After the push it posts the replies and resolves the threads.`;
};
