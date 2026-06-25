import type { WorkspaceId, WorkspaceMember } from '@goodboy/types'
import type { Database } from '../client'

type WorkspaceMemberRow = {
  member_workspace_id: string
  mount_name: string
  root_path: string
}

function toDomain(row: WorkspaceMemberRow): WorkspaceMember {
  return {
    workspaceId: row.member_workspace_id as WorkspaceId,
    rootPath: row.root_path,
    mountName: row.mount_name,
  }
}

export const listMembersForWorkspaces = async (
  db: Database,
  compositeWorkspaceIds: ReadonlyArray<WorkspaceId>,
): Promise<Map<WorkspaceId, ReadonlyArray<WorkspaceMember>>> => {
  const out = new Map<WorkspaceId, WorkspaceMember[]>()
  if (compositeWorkspaceIds.length === 0) {
    return out
  }
  const placeholders = compositeWorkspaceIds.map(() => '?').join(', ')
  const rows = await db.select<WorkspaceMemberRow & { composite_workspace_id: string }>(
    `SELECT wm.composite_workspace_id, wm.member_workspace_id, wm.mount_name, w.root_path
     FROM workspace_members wm
     JOIN workspaces w ON w.id = wm.member_workspace_id
     WHERE wm.composite_workspace_id IN (${placeholders})
     ORDER BY wm.composite_workspace_id, wm.sort_order ASC`,
    compositeWorkspaceIds,
  )
  for (const row of rows) {
    const compositeId = row.composite_workspace_id as WorkspaceId
    const bucket = out.get(compositeId) ?? []
    bucket.push(toDomain(row))
    out.set(compositeId, bucket)
  }
  return out
}

export const insertWorkspaceMembers = async (
  db: Database,
  compositeWorkspaceId: WorkspaceId,
  members: ReadonlyArray<{ workspaceId: WorkspaceId; mountName: string }>,
): Promise<void> => {
  const now = Date.now()
  let index = 0
  for (const member of members) {
    await db.execute(
      `INSERT INTO workspace_members
        (id, composite_workspace_id, member_workspace_id, mount_name, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), compositeWorkspaceId, member.workspaceId, member.mountName, index, now],
    )
    index += 1
  }
}
