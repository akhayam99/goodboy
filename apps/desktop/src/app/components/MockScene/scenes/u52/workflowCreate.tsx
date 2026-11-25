import type { ComponentType } from 'react';
import { WorkflowCreateScene } from './WorkflowCreateScene';

export const U52_WORKFLOW_CREATE_SCENES: Readonly<Record<string, ComponentType>> = {
  'u52-workflow-create-empty-light': () => <WorkflowCreateScene theme="light" state="empty" />,
  'u52-workflow-create-empty-dark': () => <WorkflowCreateScene theme="dark" state="empty" />,
  'u52-workflow-create-filled-light': () => <WorkflowCreateScene theme="light" state="filled" />,
  'u52-workflow-create-filled-dark': () => <WorkflowCreateScene theme="dark" state="filled" />,
  'u52-workflow-create-drafting-light': () => (
    <WorkflowCreateScene theme="light" state="drafting" />
  ),
  'u52-workflow-create-drafting-dark': () => <WorkflowCreateScene theme="dark" state="drafting" />,
  'u52-workflow-create-failed-light': () => (
    <WorkflowCreateScene theme="light" state="create-failed" />
  ),
  'u52-workflow-create-failed-dark': () => (
    <WorkflowCreateScene theme="dark" state="create-failed" />
  ),
};
