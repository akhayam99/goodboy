import type { Project } from '@goodboy/types';
import type { AppState } from '../../types';
import { projectById } from './projectIndex';

export const selectProjectById = (
  state: Pick<AppState, 'projects'>,
  id: string | null,
): Project | null => projectById(state.projects, id) ?? null;
