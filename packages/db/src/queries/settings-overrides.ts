import { OVERRIDE_COLUMNS } from '@goodboy/types';
import type { OverrideSettings, WorkspaceId } from '@goodboy/types';
import type { Database } from '../client';
import { overridesFromRow, type OverrideRow } from './override-row';

export const getWorkspaceOverrides = async (
  db: Database,
  workspaceId: WorkspaceId,
): Promise<OverrideSettings | null> => {
  const rows = await db.select<OverrideRow>(
    `SELECT ${OVERRIDE_COLUMNS.join(', ')} FROM workspaces WHERE id = ?`,
    [workspaceId],
  );
  const row = rows[0];
  return row === undefined ? null : overridesFromRow({ row });
};
