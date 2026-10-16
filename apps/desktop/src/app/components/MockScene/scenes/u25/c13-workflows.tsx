import { WorkflowsScene } from './c13/WorkflowsScene';

export const U25_C13_WORKFLOWS_SCENES = {
  'c13-workflows': () => <WorkflowsScene state="list" />,
  'c13-workflows-history': () => <WorkflowsScene state="history" />,
  'c13-workflows-history-empty': () => <WorkflowsScene state="history-empty" />,
  'c13-workflows-history-failed': () => <WorkflowsScene state="history-failed" />,
  'c13-workflows-history-filter': () => <WorkflowsScene state="history-filter" />,
};
