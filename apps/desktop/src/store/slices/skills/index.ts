import { deleteSkill } from './deleteSkill';
import { loadSkills } from './loadSkills';
import { rescanSkills } from './rescanSkills';
import { saveSkill } from './saveSkill';
import type { GetFn, SetFn } from './types';

export const createSkillsSlice = (set: SetFn, _get: GetFn) => {
  return {
    loadSkills: loadSkills(set),
    saveSkill: saveSkill(set),
    deleteSkill: deleteSkill(set),
    rescanSkills: rescanSkills(set),
  };
};
