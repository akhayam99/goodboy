import type { AutoLevel } from '@goodboy/core/auto';
import type { LeadPermissionsTarget } from '../../permissions/LeadPermissionsChip';
import { AsksLevelChip } from './AsksLevelChip';
import { WorkAwareChip } from './WorkAwareChip';

type PickParams = {
  readonly next: AutoLevel;
};

type Props = {
  readonly value: AutoLevel;
  readonly workspaceLevel: AutoLevel;
  readonly workspaceName: string;
  readonly error: string | null;
  readonly isDisabled: boolean;
  readonly onPick: (params: PickParams) => void;
  readonly permissions?: LeadPermissionsTarget;
};

export const AutoLevelChip = ({ permissions, ...level }: Props) => {
  const chip = <AsksLevelChip {...level} />;
  return permissions === undefined ? (
    chip
  ) : (
    <WorkAwareChip target={permissions}>{chip}</WorkAwareChip>
  );
};
