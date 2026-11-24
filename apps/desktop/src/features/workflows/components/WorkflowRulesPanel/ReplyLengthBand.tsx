import type { WorkspaceId } from '@goodboy/types';
import { Band } from '@goodboy/ui';
import { VerbositySelect } from '../../../session/verbositySelect';
import { useAppStore } from '../../../../store';
import { selectWorkspaceResolvedSettings } from '../../../../store/slices/overrides/selectResolvedSettings';
import {
  useWorkspaceOverrideSave,
  WorkspaceFieldRow,
} from '../../../settings/workspaceFieldSurfaces';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const ReplyLengthBand = ({ workspaceId }: Props) => {
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
  );
};
