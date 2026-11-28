import type { ComponentType } from 'react';
import { WorkflowsEveryRunScene } from '../../u52/WorkflowsEveryRunScene';

export const EVERY_RUN_PREFERRED_LANGUAGE_SCENES: Readonly<Record<string, ComponentType>> = {
  'every-run-preferred-language-auto-light': () => (
    <WorkflowsEveryRunScene theme="light" hasPlanRun={false} />
  ),
  'every-run-preferred-language-italian-light': () => (
    <WorkflowsEveryRunScene theme="light" hasPlanRun={false} preferredLanguage="it" />
  ),
  'every-run-preferred-language-italian-dark': () => (
    <WorkflowsEveryRunScene theme="dark" hasPlanRun={false} preferredLanguage="it" />
  ),
};
