import type { Project } from '@goodboy/types';
import { findById } from '../../../shared/utils/findById';

export const projectById = <T extends Pick<Project, 'id'>>(
  projects: ReadonlyArray<T>,
  id: string | null | undefined,
): T | undefined => findById(projects, id);
