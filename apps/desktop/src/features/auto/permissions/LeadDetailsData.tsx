import { useEffect, type ReactNode } from 'react';
import type { AutoLevel } from '@goodboy/core/auto';
import type { WorkspaceId } from '@goodboy/types';
import { useLeadPermissions, type LeadPermissionsModel } from '../hooks/useLeadPermissions';
import { leadDetailsDifferOf } from './leadDetailsDifferOf';

export type LeadDetailsDataModel = LeadPermissionsModel & {
  readonly differ: number;
};

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly leadLevel: AutoLevel;
  readonly children: (model: LeadDetailsDataModel) => ReactNode;
};

export const LeadDetailsData = ({ workspaceId, leadLevel, children }: Props) => {
  const model = useLeadPermissions({
    workspaceId,
    sessionId: null,
    treeId: null,
    scope: 'default',
  });
  const { reload } = model;
  useEffect(() => {
    void reload();
  }, [leadLevel, reload]);
  const differ =
    model.permissions === null ? 0 : leadDetailsDifferOf({ permissions: model.permissions });
  return children({ ...model, differ });
};
