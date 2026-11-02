import type { PullRequestHost } from '@goodboy/types';
import type { CommentFilter } from './commentFilter';
import { countNoun } from '../../../../shared/utils/countNoun';

export const FIX_COMMENTS_LABEL = {
  title: 'Fix comments',
  backToComment: 'Back to the comment',
  activity: 'Activity',
  comments: 'Comments',
  analyze: 'Analyze only',
  nothingSelected: 'Select a comment to start',
  selectAll: 'Select all',
  empty: 'No open comments.',
  noteChip: 'Note',
  analyzeStep: 'Analyze comments',
  fixStep: 'Fix comments',
  list: 'Open comments',
  filters: 'Comment source',
} as const;

type CountParams = {
  readonly count: number;
};

export const startFixLabel = ({ count }: CountParams): string =>
  count === 0 ? 'Start fix' : `Start fix for ${count}`;

export const fixCommentsAgentName = ({ count }: CountParams): string =>
  `Fix comments · ${countNoun({ count: count, one: 'comment' })}`;

export const FIX_COMMENTS_AGENT_PREFIX = 'Fix comments';

const HOST_LABEL = {
  github: 'On GitHub',
  gitlab: 'On GitLab',
  bitbucket: 'On Bitbucket',
} as const satisfies Record<PullRequestHost, string>;

type HostParams = {
  readonly host: PullRequestHost;
};

export const filterLabelOf = ({ host }: HostParams): Record<CommentFilter, string> => ({
  all: 'All',
  notes: 'Notes',
  host: HOST_LABEL[host],
});
