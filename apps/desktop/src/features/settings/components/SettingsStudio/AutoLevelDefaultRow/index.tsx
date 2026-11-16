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
const LABEL = `${NAMES.runKind.autoAgent} asks you`;
const HELP = `How often a run started as ${NAMES.runKind.autoAgent} stops, one permission at a time.`;

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
