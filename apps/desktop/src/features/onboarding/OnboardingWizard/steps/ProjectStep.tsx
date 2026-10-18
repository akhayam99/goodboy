import type { WorkspaceId } from '@goodboy/types';
import { NewWorkspaceForm } from '../../../../shared/components/NewWorkspaceForm';

type CreatedParams = {
  readonly workspaceId: WorkspaceId;
};

type Props = {
  readonly onCreated: (params: CreatedParams) => void;
  readonly onBack?: () => void;
};

export const ProjectStep = ({ onCreated, onBack }: Props) => (
  <NewWorkspaceForm mode="first-run" onCreated={onCreated} onCancel={onBack} backLabel="Back" />
);
