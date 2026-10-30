import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { guidanceShownOf } from '../../startRun/guidanceShownOf';
import { workspaceGuidanceOf } from '../../startRun/workspaceGuidanceOf';
import { StartGuidanceChip } from './StartGuidanceChip';
import type { StartGuidanceReader } from './startFormWords';

type PickParams = {
  readonly next: string | null;
};

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly picked: string | null;
  readonly reader: StartGuidanceReader;
  readonly isDisabled: boolean;
  readonly onPick: (params: PickParams) => void;
};

export const StartGuidanceSetting = ({
  workspaceId,
  picked,
  reader,
  isDisabled,
  onPick,
}: Props) => {
  const workspaceName = useAppStore(
    (state) =>
      state.workspaces.find((workspace) => workspace.id === workspaceId)?.name ?? 'the workspace',
  );
  const workspaceText = useAppStore((state) => workspaceGuidanceOf({ state, workspaceId }));
  return (
    <StartGuidanceChip
      value={guidanceShownOf({ picked, workspace: workspaceText })}
      workspaceText={workspaceText}
      workspaceName={workspaceName}
      reader={reader}
      isDisabled={isDisabled}
      onPick={onPick}
    />
  );
};
