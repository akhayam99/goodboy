import type { LinearIntegrationConfig } from '@goodboy/types';
import type { LinearViewer } from '../../../features/integrations/linear/client';

export function configFromViewer(viewer: LinearViewer): LinearIntegrationConfig {
  return {
    workspaceUrlKey: viewer.organization.urlKey,
    viewerUserId: viewer.id,
    viewerName: viewer.name,
  };
}
