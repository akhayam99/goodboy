import { invokeSkillList } from '../../../features/skills/skills';
import type { WorkspaceId } from '@goodboy/types';
import type { SetFn } from './types';

export function loadSkills(set: SetFn) {
  return async (workspaceId: WorkspaceId) => {
    const skills = await invokeSkillList(workspaceId);
    set((state) => ({ skills: { ...state.skills, [workspaceId]: skills } }));
  };
}
