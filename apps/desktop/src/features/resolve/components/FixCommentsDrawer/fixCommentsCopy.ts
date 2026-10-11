export const FIX_COMMENTS_LABEL = {
  title: 'Fix comments',
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
  `Fix comments · ${count} ${count === 1 ? 'comment' : 'comments'}`;

export const FIX_COMMENTS_AGENT_PREFIX = 'Fix comments';

export const FILTER_LABEL = {
  all: 'All',
  notes: 'Notes',
  host: 'On GitHub',
} as const;
