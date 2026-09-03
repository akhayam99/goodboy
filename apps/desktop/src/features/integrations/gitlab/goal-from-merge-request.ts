import type { GitlabMergeRequest } from './client';

type Params = {
  readonly mergeRequest: GitlabMergeRequest;
};

export const goalFromMergeRequest = ({ mergeRequest }: Params): string => {
  const heading = `GitLab merge request !${mergeRequest.iid}: ${mergeRequest.title.trim()}`;
  const description = (mergeRequest.description ?? '').trim();
  return description === '' ? heading : `${heading}\n\n${description}`;
};
