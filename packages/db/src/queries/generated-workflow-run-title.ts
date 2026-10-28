import type { WorkflowRunId } from '@goodboy/types';
import type { Database } from '../client';
import { cleanWorkflowRunTitle } from './workflow-run-title';

type GoalRow = {
  readonly goal: string | null;
};

type Params = {
  readonly db: Database;
  readonly workflowRunId: WorkflowRunId;
  readonly title: string;
};

export const updateGeneratedWorkflowRunTitle = async ({
  db,
  workflowRunId,
  title,
}: Params): Promise<string | null> => {
  const rows = await db.select<GoalRow>(
    'SELECT goal FROM session_workflows WHERE workflow_run_id = ?',
    [workflowRunId],
  );
  const cleaned = cleanWorkflowRunTitle({ title, goal: rows[0]?.goal });
  if (cleaned === '') {
    return null;
  }
  const { rowsAffected } = await db.execute(
    'UPDATE session_workflows SET title = ? WHERE workflow_run_id = ? AND title_user_edited = 0',
    [cleaned, workflowRunId],
  );
  return rowsAffected > 0 ? cleaned : null;
};
