import { useState } from 'react';
import { FieldRow, SegmentedTabs } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { useAutoLevel } from '../../../auto/level/useAutoLevel';
import { RUN_AUTONOMY_OPTIONS } from '../../../workflows/runAutonomy';

type Props = {
  readonly workspaceId: WorkspaceId;
};

const LABEL = 'Auto asks you';
const HELP =
  'When Auto stops for your go in this workspace. Each Auto run can change it from its settings line.';

export const AutoLevelDefaultRow = ({ workspaceId }: Props) => {
  const { level, error, pick } = useAutoLevel({ workspaceId, sessionId: null });
  const [isSaving, setIsSaving] = useState(false);
  return (
    <FieldRow
      label={LABEL}
      help={
        <>
          {HELP}
          {error === null ? null : <span role="alert"> {error}</span>}
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
