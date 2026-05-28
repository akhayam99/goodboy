import { invokeSkillRescan } from '../../../features/skills/skills';
import type { WorkspaceId } from '@goodboy/types';
import type { SetFn } from './types';

export function rescanSkills(set: SetFn) {
  return async (workspaceId: WorkspaceId) => {
    const skills = await invokeSkillRescan(workspaceId);
    set((state) => ({ skills: { ...state.skills, [workspaceId]: skills } }));
  };
}
