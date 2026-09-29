import type { Skill, WorkspaceId } from '@goodboy/types';
import { invokeSkillList, invokeSkillRescan } from '../../../features/skills/skills';
import { WORKSPACE_FEATURES } from '../../../shared/lib/features';

export const rescanWorkspaceSkills = async (
  workspaceId: WorkspaceId,
): Promise<ReadonlyArray<Skill>> => {
  if (!WORKSPACE_FEATURES.skills) {
    return [];
  }
  return invokeSkillRescan(workspaceId).catch(() => []);
};

export const listWorkspaceSkills = async (
  workspaceId: WorkspaceId,
): Promise<ReadonlyArray<Skill>> => {
  if (!WORKSPACE_FEATURES.skills) {
    return [];
  }
  return invokeSkillList(workspaceId).catch(() => []);
};
