import type { WorkspaceId, Skill } from '@goodboy/types';

export type SkillsState = {
  readonly skills: Readonly<Record<WorkspaceId, ReadonlyArray<Skill>>>;
};

export const skillsInitialState: SkillsState = {
  skills: {},
};
