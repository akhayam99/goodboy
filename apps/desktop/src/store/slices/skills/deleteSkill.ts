import { invokeSkillDelete, invokeSkillList } from '../../../features/skills/skills';
import type { SkillId, WorkspaceId } from '@goodboy/types';
import type { SetFn } from './types';

export function deleteSkill(set: SetFn) {
  return async (skillId: SkillId, workspaceId: WorkspaceId) => {
    await invokeSkillDelete(skillId);
    const skills = await invokeSkillList(workspaceId);
    set((state) => ({ skills: { ...state.skills, [workspaceId]: skills } }));
  };
}
