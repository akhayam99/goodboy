import type { ComponentType } from 'react';
import { WorkflowsEveryRunScene } from './WorkflowsEveryRunScene';

export const U52_WORKFLOWS_EVERY_RUN_SCENES: Readonly<Record<string, ComponentType>> = {
  'u52-workflows-every-run-light': () => (
    <WorkflowsEveryRunScene theme="light" hasPlanRun={false} />
  ),
  'u52-workflows-every-run-dark': () => <WorkflowsEveryRunScene theme="dark" hasPlanRun={false} />,
  'u52-workflows-every-run-plan-light': () => <WorkflowsEveryRunScene theme="light" hasPlanRun />,
  'u52-workflows-every-run-plan-dark': () => <WorkflowsEveryRunScene theme="dark" hasPlanRun />,
};
