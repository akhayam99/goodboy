import type { ComponentProps } from 'react';
import { WelcomeStep } from './steps/WelcomeStep';
import { ProvidersStep } from './steps/ProvidersStep';
import { ProjectStep } from './steps/ProjectStep';
import { CodeHostStep } from './steps/CodeHostStep';
import { TasksStep } from './steps/TasksStep';
import { FirstSessionStep } from './steps/FirstSessionStep';
import type { WizardStepId } from './wizardSteps';

type Props = {
  readonly step: WizardStepId;
  readonly projectStep: ComponentProps<typeof ProjectStep>;
  readonly codeHostStep: ComponentProps<typeof CodeHostStep> | null;
  readonly tasksStep: ComponentProps<typeof TasksStep> | null;
  readonly firstSessionStep: ComponentProps<typeof FirstSessionStep>;
};

export const WizardStepBody = ({
  step,
  projectStep,
  codeHostStep,
  tasksStep,
  firstSessionStep,
}: Props) => {
  switch (step) {
    case 'welcome':
      return <WelcomeStep />;
    case 'providers':
      return <ProvidersStep />;
    case 'project':
      return <ProjectStep {...projectStep} />;
    case 'code-host':
      return codeHostStep === null ? null : <CodeHostStep {...codeHostStep} />;
    case 'tasks':
      return tasksStep === null ? null : <TasksStep {...tasksStep} />;
    case 'first-session':
      return <FirstSessionStep {...firstSessionStep} />;
    default: {
      const exhaustive: never = step;
      return exhaustive;
    }
  }
};
