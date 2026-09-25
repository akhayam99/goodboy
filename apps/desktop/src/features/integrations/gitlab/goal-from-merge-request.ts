import { composeGoal } from '../shared/composeGoal';
import type { GitlabMergeRequest } from './client';

type Params = {
  readonly mergeRequest: GitlabMergeRequest;
};

export const goalFromMergeRequest = ({ mergeRequest }: Params): string =>
  composeGoal({
    heading: `GitLab merge request !${mergeRequest.iid}: ${mergeRequest.title.trim()}`,
    body: (mergeRequest.description ?? '').trim(),
    source: {
      noun: 'merge request',
      reference: `!${mergeRequest.iid}`,
      url: mergeRequest.webUrl ?? null,
    },
  });
