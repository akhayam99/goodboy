import type { ComponentType } from 'react';
import { BreadcrumbsScene } from '../u27/breadcrumbs/BreadcrumbsScene';

export const U36_ADDRESS_SCENES: Readonly<Record<string, ComponentType>> = {
  'u36-p6-gone-run-light': () => <BreadcrumbsScene theme="light" placeId="goneRun" />,
  'u36-p6-gone-run-dark': () => <BreadcrumbsScene theme="dark" placeId="goneRun" />,
  'u36-p6-step-back-light': () => <BreadcrumbsScene theme="light" placeId="step" />,
  'u36-p6-step-back-dark': () => <BreadcrumbsScene theme="dark" placeId="step" />,
};
