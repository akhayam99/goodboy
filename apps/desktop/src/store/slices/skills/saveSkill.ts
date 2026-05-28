import {
  invokeSkillList,
  invokeSkillUpsert,
  type SkillUpsertArgs,
} from '../../../features/skills/skills';
import type { SetFn } from './types';

export function saveSkill(set: SetFn) {
  return async (input: SkillUpsertArgs) => {
    await invokeSkillUpsert(input);
    const skills = await invokeSkillList(input.workspaceId);
    set((state) => ({ skills: { ...state.skills, [input.workspaceId]: skills } }));
  };
}
