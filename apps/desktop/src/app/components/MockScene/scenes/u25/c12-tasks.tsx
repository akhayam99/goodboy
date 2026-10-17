import { TasksScene } from './c12/TasksScene';

export const U25_C12_TASK_SCENES = {
  'c12-tasks-forme': () => <TasksScene state="forme" />,
  'c12-tasks-all': () => <TasksScene state="all" />,
  'c12-tasks-expanded': () => <TasksScene state="expanded" />,
  'c12-tasks-lookup': () => <TasksScene state="lookup" />,
  'c12-tasks-ratelimited': () => <TasksScene state="ratelimited" />,
  'c12-tasks-filter': () => <TasksScene state="filter" />,
  'c12-issue-pane': () => <TasksScene state="issue-pane" />,
  'c12-issue-github': () => <TasksScene state="issue-github" />,
  'c12-issue-edit': () => <TasksScene state="issue-edit" />,
  'c12-issue-sentry': () => <TasksScene state="issue-sentry" />,
  'c12-issue-full': () => <TasksScene state="issue-full" />,
};
