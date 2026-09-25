import type { ComponentProps } from 'react';
import type { Workspace, WorkspaceProfile } from '@goodboy/types';
import type { ProjectAttachConflict } from '../../../store/slices/projects/addProject';
import { WelcomeStep } from './steps/WelcomeStep';
import { ProvidersStep } from './steps/ProvidersStep';
import { ShapeStep } from './steps/ShapeStep';
import { ProjectsStep } from './steps/ProjectsStep';
import { ProfileStep } from './steps/ProfileStep';
import { ReadyStep } from './steps/ReadyStep';
import type { WizardStepId } from './wizardSteps';

type Props = {
  readonly step: WizardStepId;
  readonly shapeStep: ComponentProps<typeof ShapeStep>;
  readonly workspace: Workspace | null;
  readonly pendingConflicts: ReadonlyArray<ProjectAttachConflict>;
  readonly profile: WorkspaceProfile;
  readonly onProfileChange: (profile: WorkspaceProfile) => void;
};

export const WizardStepBody = ({
  step,
  shapeStep,
  workspace,
  pendingConflicts,
  profile,
  onProfileChange,
}: Props) => {
  switch (step) {
    case 'welcome':
      return <WelcomeStep />;
    case 'providers':
      return <ProvidersStep />;
    case 'shape':
      return <ShapeStep {...shapeStep} />;
    case 'projects':
      return (
        workspace !== null && (
          <ProjectsStep workspace={workspace} initialConflicts={pendingConflicts} />
        )
      );
    case 'profile':
      return <ProfileStep profile={profile} onProfileChange={onProfileChange} />;
    case 'ready':
      return <ReadyStep />;
    default: {
      const exhaustive: never = step;
      return exhaustive;
    }
  }
};
