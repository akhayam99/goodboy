import { Grid } from '../components/Grid';
import { ARTIFACTS_COMPARE, INBOX_ISSUE } from '../figures';

export const WorkflowsGrid = () => (
  <Grid
    label="Inbox and artifacts"
    cells={[
      {
        figure: INBOX_ISSUE,
        title: 'Inbox',
        text: 'Issues and pull requests from GitHub, Linear, Jira, Sentry and Slack in one list. Open one and the session starts with its brief drafted, or press L in a session to link one to it.',
      },
      {
        figure: ARTIFACTS_COMPARE,
        title: 'Plans, reports and wireframes',
        text: 'Kept next to the task, with versions you can compare.',
      },
    ]}
  />
);
