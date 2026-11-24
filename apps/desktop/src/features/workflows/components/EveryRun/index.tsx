import { useMemo } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { Band } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { WorkflowRulesPanel } from '../WorkflowRulesPanel';
import { ReplyLengthBand } from '../WorkflowRulesPanel/ReplyLengthBand';
import {
  RunsAdvancedBand,
  SettingRowFocusContext,
  WorkspaceFieldRow,
} from '../../../settings/workspaceFieldSurfaces';
import { DefaultModeCards } from '../../../permissions/permissionDefaultSurfaces';
import { EveryRunModels } from './EveryRunModels';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const EveryRun = ({ workspaceId }: Props) => {
  const row = useAppStore((state) => state.everyRunFocusRow);
  const setEveryRunFocusRow = useAppStore((state) => state.setEveryRunFocusRow);
  const rowFocus = useMemo(
    () => ({ row, onShown: () => setEveryRunFocusRow({ row: null }) }),
    [row, setEveryRunFocusRow],
  );

  return (
    <SettingRowFocusContext value={rowFocus}>
      <WorkflowRulesPanel
        workspaceId={workspaceId}
        advanced={<RunsAdvancedBand workspaceId={workspaceId} />}
      >
        <Band inset="content" label="Edits" ariaLabel="Edits" headingLevel={2}>
          <WorkspaceFieldRow workspaceId={workspaceId} field="permissionMode" layout="stacked">
            <DefaultModeCards workspaceId={workspaceId} />
          </WorkspaceFieldRow>
        </Band>
        <ReplyLengthBand workspaceId={workspaceId} />
        <EveryRunModels workspaceId={workspaceId} />
      </WorkflowRulesPanel>
    </SettingRowFocusContext>
  );
};
