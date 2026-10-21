import type { ComponentType } from 'react';
import { BreadcrumbsScene } from './breadcrumbs/BreadcrumbsScene';

export const U27_BREADCRUMBS_SCENES: Readonly<Record<string, ComponentType>> = {
  'u27-breadcrumbs-after-run-light': () => <BreadcrumbsScene theme="light" placeId="run" />,
  'u27-breadcrumbs-after-run-dark': () => <BreadcrumbsScene theme="dark" placeId="run" />,
  'u27-breadcrumbs-after-step-light': () => <BreadcrumbsScene theme="light" placeId="step" />,
  'u27-breadcrumbs-after-step-dark': () => <BreadcrumbsScene theme="dark" placeId="step" />,
  'u27-breadcrumbs-after-agent-light': () => <BreadcrumbsScene theme="light" placeId="agent" />,
  'u27-breadcrumbs-after-agent-dark': () => <BreadcrumbsScene theme="dark" placeId="agent" />,
  'u27-breadcrumbs-after-artifact-light': () => (
    <BreadcrumbsScene theme="light" placeId="artifact" />
  ),
  'u27-breadcrumbs-after-artifact-dark': () => <BreadcrumbsScene theme="dark" placeId="artifact" />,
  'u27-breadcrumbs-after-branch-file-light': () => (
    <BreadcrumbsScene theme="light" placeId="branchFile" />
  ),
  'u27-breadcrumbs-after-branch-file-dark': () => (
    <BreadcrumbsScene theme="dark" placeId="branchFile" />
  ),
};
