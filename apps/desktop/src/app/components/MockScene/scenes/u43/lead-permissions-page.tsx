import type { ComponentType } from 'react';
import { LeadPermissionsPageScene } from './LeadPermissionsPageScene';

const TUNED = { push: 'ask', dependencies: 'ask' } as const;

export const U43_LEAD_PERMISSIONS_PAGE_SCENES: Readonly<Record<string, ComponentType>> = {
  'lead-permissions-page': () => <LeadPermissionsPageScene leadRows={TUNED} step="menu" />,
  'lead-permissions-head': () => <LeadPermissionsPageScene leadRows={{}} step="head" />,
  'lead-permissions-level-menu': () => <LeadPermissionsPageScene leadRows={{}} step="menu" />,
  'lead-details-drawer': () => <LeadPermissionsPageScene leadRows={TUNED} step="drawer" />,
};
