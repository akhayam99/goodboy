import { useMemo } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import {
  LeadPermissionsChip,
  type LeadPermissionsTarget,
} from '../../../../auto/permissions/LeadPermissionsChip';
import { NAMES } from '../../../../../shared/utils/names';
import { SettingRow } from '../SettingRow';

type Props = {
  readonly workspaceId: WorkspaceId;
};

const ROW_KEY = 'auto-asks';
const LABEL = `${NAMES.lead} asks you`;
const HELP = `How often a run led by the ${NAMES.lead} stops, one permission at a time.`;

export const AutoLevelDefaultRow = ({ workspaceId }: Props) => {
  const target = useMemo(
    (): LeadPermissionsTarget => ({ workspaceId, sessionId: null, treeId: null }),
    [workspaceId],
  );
  return (
    <SettingRow label={LABEL} rowKey={ROW_KEY} help={HELP}>
      <LeadPermissionsChip target={target} />
    </SettingRow>
  );
};
