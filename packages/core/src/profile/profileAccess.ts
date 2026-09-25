import type { AgentRole } from '@goodboy/types';

export type ProfileField = 'roles' | 'aboutWork' | 'workingRules' | 'explainMore';

export type ProfileAudience = AgentRole | 'orchestrator' | 'questionDelegate';

const PLANNING = ['roles', 'aboutWork', 'workingRules'] satisfies ReadonlyArray<ProfileField>;
const SEARCHING = ['roles', 'aboutWork', 'explainMore'] satisfies ReadonlyArray<ProfileField>;
const BUILDING = ['roles', 'workingRules'] satisfies ReadonlyArray<ProfileField>;
const EXPLAINING = ['roles', 'workingRules', 'explainMore'] satisfies ReadonlyArray<ProfileField>;
const WRITING = ['roles', 'aboutWork', 'explainMore'] satisfies ReadonlyArray<ProfileField>;
const EVERYTHING = [
  'roles',
  'aboutWork',
  'workingRules',
  'explainMore',
] satisfies ReadonlyArray<ProfileField>;

export const PROFILE_ACCESS: Readonly<Record<ProfileAudience, ReadonlyArray<ProfileField>>> = {
  planner: PLANNING,
  orchestrator: PLANNING,
  scout: SEARCHING,
  investigator: SEARCHING,
  implementer: BUILDING,
  tester: BUILDING,
  docs: BUILDING,
  reviewer: EXPLAINING,
  resolver: EXPLAINING,
  report: WRITING,
  wireframe: WRITING,
  custom: EVERYTHING,
  questionDelegate: PLANNING,
};
