import type { ComponentType } from 'react';
import { ProjectsCardScene } from './ProjectsCardScene';

export const OVERVIEW_PROJECTS_CARD_SCENES: Readonly<Record<string, ComponentType>> = {
  'overview-projects-head-light': () => <ProjectsCardScene theme="light" isConfirmOpen={false} />,
  'overview-projects-head-dark': () => <ProjectsCardScene theme="dark" isConfirmOpen={false} />,
  'overview-projects-close-light': () => <ProjectsCardScene theme="light" isConfirmOpen />,
  'overview-projects-close-dark': () => <ProjectsCardScene theme="dark" isConfirmOpen />,
};
