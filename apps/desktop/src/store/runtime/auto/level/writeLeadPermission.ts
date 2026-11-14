import {
  parseLeadPermissionRows,
  type LeadPermissionKey,
  type LeadPermissionValue,
} from '@goodboy/core/auto';
import {
  getAutoTreePermissions,
  getWorkspaceValue,
  insertWorkspaceValueIfAbsent,
  replaceWorkspaceValueIfUnchanged,
  setAutoTreePermissionsIfUnchanged,
  type Database,
} from '@goodboy/db';
import type { AutoTreeId, WorkspaceId } from '@goodboy/types';

type TreeTarget = { readonly treeId: AutoTreeId };

type DefaultTarget = { readonly workspaceId: WorkspaceId };

export type LeadPermissionWriteTarget = DefaultTarget | TreeTarget;

export type LeadPermissionChange = {
  readonly [K in LeadPermissionKey]: Readonly<{ key: K; value: LeadPermissionValue<K> | null }>;
}[LeadPermissionKey];

type Params = {
  readonly db: Database;
  readonly target: LeadPermissionWriteTarget;
  readonly change: LeadPermissionChange;
  readonly nowMs: number;
};

type NextRowsParams = {
  readonly raw: string | null;
  readonly change: LeadPermissionChange;
};

const nextRowsOf = ({ raw, change }: NextRowsParams): string | null => {
  const current = parseLeadPermissionRows({ raw });
  const value = change.value ?? undefined;
  if (current[change.key] === value) {
    return null;
  }
  const next: Readonly<Record<string, unknown>> = { ...current, [change.key]: value };
  return JSON.stringify(next);
};

type TreeWriteParams = Omit<Params, 'target'> & { readonly target: TreeTarget };

const LEAD_GONE = 'The Lead no longer exists.';

const writeTreeOnce = async ({ db, target, change, nowMs }: TreeWriteParams): Promise<boolean> => {
  const raw = await getAutoTreePermissions({ db, treeId: target.treeId });
  if (raw === null) {
    throw new Error(LEAD_GONE);
  }
  const permissions = nextRowsOf({ raw, change });
  if (permissions === null) {
    return true;
  }
  const outcome = await setAutoTreePermissionsIfUnchanged({
    db,
    treeId: target.treeId,
    expected: raw,
    permissions,
    nowMs,
  });
  if (outcome.kind === 'missing') {
    throw new Error(LEAD_GONE);
  }
  return outcome.kind === 'applied';
};

type DefaultWriteParams = Omit<Params, 'target' | 'nowMs'> & { readonly target: DefaultTarget };

const writeDefaultOnce = async ({ db, target, change }: DefaultWriteParams): Promise<boolean> => {
  const key = 'auto.permissions';
  const workspaceId = target.workspaceId;
  const raw = await getWorkspaceValue({ db, workspaceId, key });
  const value = nextRowsOf({ raw, change });
  if (value === null) {
    return true;
  }
  if (raw === null) {
    return insertWorkspaceValueIfAbsent({ db, workspaceId, key, value });
  }
  return replaceWorkspaceValueIfUnchanged({ db, workspaceId, key, expected: raw, value });
};

const MAX_ATTEMPTS = 2;

export const writeLeadPermission = async ({ db, target, change, nowMs }: Params): Promise<void> => {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const isWritten =
      'treeId' in target
        ? await writeTreeOnce({ db, target, change, nowMs })
        : await writeDefaultOnce({ db, target, change });
    if (isWritten) {
      return;
    }
  }
  throw new Error('This permission changed in another window. Pick it again.');
};
