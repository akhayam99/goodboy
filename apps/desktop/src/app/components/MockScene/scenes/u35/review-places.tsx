import type { ComponentType } from 'react';
import { BreadcrumbsScene } from '../u27/breadcrumbs/BreadcrumbsScene';

export const U35_REVIEW_PLACE_SCENES: Readonly<Record<string, ComponentType>> = {
  'u35-agent-chain-sub-sub': () => <BreadcrumbsScene theme="light" placeId="chain" />,
  'u35-branch-setup-offer': () => <BreadcrumbsScene theme="light" placeId="branchSetup" />,
};
