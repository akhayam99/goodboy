import type { ComponentType } from 'react';
import { LeadPermissionsPageScene } from './LeadPermissionsPageScene';

export const U43_LEAD_PERMISSIONS_PAGE_SCENES: Readonly<Record<string, ComponentType>> = {
  'lead-permissions-page': () => (
    <LeadPermissionsPageScene leadRows={{ push: 'ask', dependencies: 'ask' }} isOpen />
  ),
  'lead-permissions-head': () => <LeadPermissionsPageScene leadRows={{}} isOpen={false} />,
};
