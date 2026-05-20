import {
  invokeSkillList,
  invokeSkillUpsert,
  invokeSkillDelete,
  invokeSkillRescan,
  type SkillUpsertArgs,
} from '../../features/skills/skills';
import type { SkillId, WorkspaceId } from '@goodboy/types';
import type { AppStore } from '../store';

type SetFn = (p: Partial<AppStore> | ((s: AppStore) => Partial<AppStore>)) => void;
type GetFn = () => AppStore;

export function createSkillsSlice(set: SetFn, _get: GetFn) {
  return {
    loadSkills: async (workspaceId: WorkspaceId) => {
      const skills = await invokeSkillList(workspaceId);
      set((state) => ({ skills: { ...state.skills, [workspaceId]: skills } }));
    },

    saveSkill: async (input: SkillUpsertArgs) => {
      await invokeSkillUpsert(input);
      const skills = await invokeSkillList(input.workspaceId);
      set((state) => ({ skills: { ...state.skills, [input.workspaceId]: skills } }));
    },

    deleteSkill: async (skillId: SkillId, workspaceId: WorkspaceId) => {
      await invokeSkillDelete(skillId);
      const skills = await invokeSkillList(workspaceId);
      set((state) => ({ skills: { ...state.skills, [workspaceId]: skills } }));
    },

    rescanSkills: async (workspaceId: WorkspaceId) => {
      const skills = await invokeSkillRescan(workspaceId);
      set((state) => ({ skills: { ...state.skills, [workspaceId]: skills } }));
    },
  };
}
