import { useMemo, useState } from 'react';
import { FieldRow, SegmentedTabs } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { useAutoLevel } from '../../../../../shared/hooks/useAutoLevel';
import { useIsWorkOn } from '../../../../../shared/hooks/useIsWorkOn';
import {
  LeadPermissionsChip,
  type LeadPermissionsTarget,
} from '../../../../auto/permissions/LeadPermissionsChip';
import { NAMES } from '../../../../../shared/utils/names';
import { RUN_AUTONOMY_OPTIONS } from '../../../../workflows/runAutonomy';

type Props = {
  readonly workspaceId: WorkspaceId;
};

const LABEL = `${NAMES.runKind.autoAgent} asks you`;
const HELP = `How often a run started as ${NAMES.runKind.autoAgent} stops for your go.`;
const WORK_HELP = `How often a run started as ${NAMES.runKind.autoAgent} stops, one permission at a time.`;

export const AutoLevelDefaultRow = ({ workspaceId }: Props) => {
  const { level, error, pick } = useAutoLevel({ workspaceId, sessionId: null });
  const [isSaving, setIsSaving] = useState(false);
  const isWorkOn = useIsWorkOn();
  const target = useMemo(
    (): LeadPermissionsTarget => ({ workspaceId, sessionId: null, treeId: null }),
    [workspaceId],
  );
  if (isWorkOn) {
    return (
      <FieldRow label={LABEL} help={WORK_HELP}>
        <LeadPermissionsChip target={target} />
      </FieldRow>
    );
  }
  return (
    <FieldRow
      label={LABEL}
      help={
        <>
          {HELP}
          {error === null ? null : (
            <span role="alert" className="text-danger">
              {' '}
              {error}
            </span>
          )}
        </>
      }
    >
      <SegmentedTabs
        ariaLabel={LABEL}
        size="sm"
        value={level}
        options={RUN_AUTONOMY_OPTIONS.map((option) => ({
          value: option.key,
          label: option.label,
          tooltip: option.hint,
          disabled: isSaving,
        }))}
        onChange={(next) => {
          setIsSaving(true);
          void pick({ next }).finally(() => setIsSaving(false));
        }}
      />
    </FieldRow>
  );
};
