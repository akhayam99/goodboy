import { NAMES } from '../../../../shared/utils/names';

type NameParams = {
  readonly name: string;
};

export const DESK_PR_COPY = {
  title: NAMES.pullRequest,
  tabsLabel: `${NAMES.pullRequest} views`,
  checks: 'Checks',
  conversation: NAMES.conversation,
  openPullRequest: 'Open pull request',
  noPullRequest: 'No pull request on this branch yet.',
  logOf: ({ name }: NameParams) => `Log of ${name}`,
  readingLog: 'Reading the log',
  unreadable: 'Not readable here.',
  openLog: 'Open log',
  noComments: 'No comments yet.',
  commentsLabel: 'Comments on this pull request',
} as const;
