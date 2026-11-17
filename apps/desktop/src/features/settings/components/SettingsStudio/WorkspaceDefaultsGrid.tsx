import type { WorkspaceId } from '@goodboy/types';
import { Band } from '@goodboy/ui';
import { VerbositySelect } from '../../../../features/session/components/VerbositySelect';
import { useAppStore } from '../../../../store';
import { selectWorkspaceResolvedSettings } from '../../../../store/slices/overrides/selectResolvedSettings';
import { WorkflowRulesPanel } from '../../../workflows/workflowRulesPanel';
import { useWorkspaceOverrideSave } from '../../hooks/useWorkspaceOverrideSave';
import { RunsAdvancedBand } from './RunsAdvancedBand';
import { WorkspaceFieldRow } from './WorkspaceFieldRow';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const WorkspaceDefaultsGrid = ({ workspaceId }: Props) => {
  const verbosity = useAppStore(
    (s) => selectWorkspaceResolvedSettings({ state: s, workspaceId }).defaultVerbosity,
  );
  const verbositySave = useWorkspaceOverrideSave({
    workspaceId,
    field: 'verbosity',
    saved: verbosity,
    patchOf: ({ value }) => ({ defaultVerbosity: value }),
  });

  return (
    <WorkflowRulesPanel
      workspaceId={workspaceId}
      advanced={<RunsAdvancedBand workspaceId={workspaceId} />}
    >
      <Band inset="content" label="Agents" ariaLabel="Agents" headingLevel={2}>
        <WorkspaceFieldRow
          workspaceId={workspaceId}
          field="verbosity"
          help="How much agents say while they work."
        >
          <VerbositySelect
            value={verbositySave.value}
            onChange={(v) => void verbositySave.save({ value: v })}
            disabled={false}
          />
        </WorkspaceFieldRow>
      </Band>
    </WorkflowRulesPanel>
  );
};
