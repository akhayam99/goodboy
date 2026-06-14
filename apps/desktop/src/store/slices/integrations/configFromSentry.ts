import type { SentryIntegrationConfig } from '@goodboy/types';
import type { SentryProject } from '../../../features/integrations/sentry/client';

export const configFromSentry = (project: SentryProject): SentryIntegrationConfig => {
  return {
    org: project.organization.slug,
    project: project.slug,
    projectName: project.name,
    orgName: project.organization.name,
  };
};
