import type { WorkspaceId, WorkspaceIntegrationProvider } from '@goodboy/types';
import { FORM_BODIES } from '../../../integrations/formBodies';
import { TOOL_CATALOG } from '../../../integrations/toolCatalog';
import { ToolSection } from './ToolSection';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly tool: WorkspaceIntegrationProvider;
  readonly label: string;
};

export const ToolSetupSection = ({ workspaceId, tool, label }: Props) => {
  const FormBody = FORM_BODIES[tool];
  const purpose = TOOL_CATALOG.find((entry) => entry.provider === tool)?.connectedLabel;
  return (
    <ToolSection label={`Connect ${label}`} meta={purpose}>
      <FormBody workspaceId={workspaceId} />
    </ToolSection>
  );
};
