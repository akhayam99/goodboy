import type { LinearIssue } from '../../../../../features/integrations/linear/client';
import { STORY_ISSUE } from './storyContent';

const HOUR_MS = 3_600_000;

type IssueParams = {
  readonly identifier: string;
  readonly title: string;
  readonly description: string | null;
  readonly hoursAgo: number;
};

const issueOf = ({ identifier, title, description, hoursAgo }: IssueParams): LinearIssue => ({
  id: `demo-story-linear-${identifier}`,
  identifier,
  title,
  description,
  url: `https://example.invalid/linear/${identifier}`,
  state: { name: 'Todo', type: 'unstarted' },
  team: { key: 'HBL' },
  updatedAt: new Date(Date.now() - hoursAgo * HOUR_MS).toISOString(),
});

export const storyIssuesOf = (): ReadonlyArray<LinearIssue> => [
  issueOf({
    identifier: STORY_ISSUE.identifier,
    title: STORY_ISSUE.title,
    description: STORY_ISSUE.description,
    hoursAgo: 1,
  }),
  issueOf({
    identifier: 'HBL-409',
    title: 'Settlement export rounds a cent off',
    description: null,
    hoursAgo: 5,
  }),
  issueOf({
    identifier: 'HBL-397',
    title: 'Rotate the processor signing secret',
    description: null,
    hoursAgo: 30,
  }),
];
