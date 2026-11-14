import {
  leadPermissionsOf,
  parseLeadPermissionRows,
  type LeadPermissions,
} from '@goodboy/core/auto';
import {
  getAutoTree,
  getAutoTreePermissions,
  getSetting,
  getWorkspaceValue,
  type Database,
} from '@goodboy/db';
import type { AutoTreeId, SessionId, WorkspaceId } from '@goodboy/types';
import { isAutoPlanApprovalRequired } from '../../../../features/auto/isAutoPlanApprovalRequired';
import { SETTING_AUTO_PLAN_APPROVAL } from '../../../../features/settings/settings';
import { autoLevelSetting, type AutoLevelTarget } from './autoLevelSetting';

export type LeadPermissionsTarget =
  | { readonly treeId: AutoTreeId }
  | { readonly sessionId: SessionId }
  | { readonly workspaceId: WorkspaceId };

type Params = {
  readonly db: Database;
  readonly target: LeadPermissionsTarget;
  readonly isWorkFlowOn: boolean;
};

type LeadFacts = Readonly<{
  levelTarget: AutoLevelTarget;
  leadRaw: string | null;
  spendLimitUsd: number | null;
}>;

type LeadFactsParams = { readonly db: Database; readonly target: LeadPermissionsTarget };

const leadFactsOf = async ({ db, target }: LeadFactsParams): Promise<LeadFacts> => {
  if (!('treeId' in target)) {
    return { levelTarget: target, leadRaw: null, spendLimitUsd: null };
  }
  const tree = await getAutoTree({ db, treeId: target.treeId });
  if (tree === null) {
    throw new Error('The Lead no longer exists.');
  }
  const leadRaw = await getAutoTreePermissions({ db, treeId: target.treeId });
  return { levelTarget: { sessionId: tree.sessionId }, leadRaw, spendLimitUsd: tree.capUsd };
};

export const readLeadPermissions = async ({
  db,
  target,
  isWorkFlowOn,
}: Params): Promise<LeadPermissions> => {
  const { levelTarget, leadRaw, spendLimitUsd } = await leadFactsOf({ db, target });
  const level = await autoLevelSetting({ db, target: levelTarget });
  const defaultRaw = await getWorkspaceValue({
    db,
    workspaceId: level.workspaceId,
    key: 'auto.permissions',
  });
  const approval = await getSetting(db, SETTING_AUTO_PLAN_APPROVAL);
  return leadPermissionsOf({
    leadRows: parseLeadPermissionRows({ raw: leadRaw }),
    defaultRows: parseLeadPermissionRows({ raw: defaultRaw }),
    sessionLevel:
      'sessionId' in levelTarget ? (level.value.sessions[levelTarget.sessionId] ?? null) : null,
    workspaceLevel: level.value.defaultLevel,
    isPlanApprovalOff: !isAutoPlanApprovalRequired({
      settings: { [SETTING_AUTO_PLAN_APPROVAL]: approval ?? '' },
    }),
    isWorkFlowOn,
    spendLimitUsd,
  });
};
