import type { WorkspaceId } from '@goodboy/types';
import { NewWorkspaceForm } from '../../../../shared/components/NewWorkspaceForm';

type CreatedParams = {
  readonly workspaceId: WorkspaceId;
};

type Props = {
  readonly onCreated: (params: CreatedParams) => void;
  readonly onBack: (() => void) | null;
};

export const WorkspaceStep = ({ onCreated, onBack }: Props) => (
  <NewWorkspaceForm
    mode="first-run"
    titleRole="display"
    onCreated={onCreated}
    onCancel={onBack ?? undefined}
    backLabel="Back"
  />
);
