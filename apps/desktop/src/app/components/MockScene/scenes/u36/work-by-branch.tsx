import type { ComponentType } from 'react';
import { C08RunScene } from '../u25/C08RunScene';
import { BranchNextScene } from './BranchNextScene';
import { seedBranchLinks, seedWorkArtifacts, seedWorkQuestions } from './workByBranchSeed';

export const U36_WORK_BY_BRANCH_SCENES = {
  'u36-c19-questions-by-branch': () => (
    <C08RunScene state="working" selection="list" extra={seedWorkQuestions} />
  ),
  'u36-c19-artifacts-by-branch': () => (
    <C08RunScene state="working" selection="list" extra={seedWorkArtifacts} />
  ),
  'u36-c19-branch-links': () => <BranchNextScene phase="running" extra={seedBranchLinks} />,
} satisfies Readonly<Record<string, ComponentType>>;
