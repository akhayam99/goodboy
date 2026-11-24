import { useEffect } from 'react';
import { applyDocumentTheme } from '../../../../../../shared/lib/theme';
import { TasksStage } from '../../u25/c12/TasksStage';
import { WORKSPACE_TASKS } from '../../u25/c12/tasksSeed';

const FAILURES = { sentry: 'The token was refused (401).' };

type Props = {
  readonly theme: 'light' | 'dark';
};

export const TasksFailureScene = ({ theme }: Props) => {
  useEffect(() => {
    applyDocumentTheme({ theme });
  }, [theme]);
  return <TasksStage records={WORKSPACE_TASKS} scope="all" groupBy="source" failures={FAILURES} />;
};
