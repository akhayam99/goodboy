import { deleteSkill } from './deleteSkill';
import { loadSkills } from './loadSkills';
import { rescanSkills } from './rescanSkills';
import { saveSkill } from './saveSkill';
import type { SliceDeps } from '../../slice-types';

export const createSkillsSlice = ({ set }: SliceDeps) => {
  return {
    loadSkills: loadSkills(set),
    saveSkill: saveSkill(set),
    deleteSkill: deleteSkill(set),
    rescanSkills: rescanSkills(set),
  };
};
