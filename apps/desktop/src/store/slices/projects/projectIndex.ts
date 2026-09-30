import type { Project } from '@goodboy/types';
import { findById } from '../../../shared/utils/findById';

export const projectById = <T extends Pick<Project, 'id'>>(
  projects: ReadonlyArray<T> | null | undefined,
  id: string | null | undefined,
): T | undefined => findById(projects, id);
