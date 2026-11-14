import { Band } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { LeadPermissionsData } from '../../../auto/permissions/LeadPermissionsData';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const AutonomyDefaultsBand = ({ workspaceId }: Props) => (
  <Band inset="content" label="Asks you" ariaLabel="Asks you" headingLevel={2}>
    <LeadPermissionsData workspaceId={workspaceId} sessionId={null} treeId={null} scope="default" />
  </Band>
);
