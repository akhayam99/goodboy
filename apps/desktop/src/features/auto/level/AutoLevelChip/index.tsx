import type { AutoLevel } from '@goodboy/core/auto';
import {
  LeadPermissionsChip,
  type LeadPermissionsTarget,
} from '../../permissions/LeadPermissionsChip';
import { AsksLevelChip } from './AsksLevelChip';

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
  readonly label?: string;
};

export const AutoLevelChip = ({ permissions, ...level }: Props) =>
  permissions === undefined || (permissions.sessionId === null && permissions.treeId === null) ? (
    <AsksLevelChip {...level} />
  ) : (
    <LeadPermissionsChip target={permissions} />
  );
