import { Grid } from '../components/Grid';
import { ARTIFACTS_COMPARE, INBOX_ISSUE, REVIEW_REPLY } from '../figures';

export const WorkflowsGrid = () => (
  <Grid
    label="Inbox, review and artifacts"
    cells={[
      {
        figure: INBOX_ISSUE,
        title: 'Inbox',
        text: 'Issues and pull requests from GitHub, Linear, Sentry and Slack, in one list.',
      },
      {
        figure: REVIEW_REPLY,
        title: 'Pull request review',
        text: 'Each comment becomes a commit, with a drafted reply you approve.',
      },
      {
        figure: ARTIFACTS_COMPARE,
        title: 'Plans, reports and wireframes',
        text: 'Kept next to the task, with versions you can compare.',
      },
    ]}
  />
);
