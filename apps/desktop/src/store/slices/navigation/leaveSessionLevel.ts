import { pickSidebarLevel } from './pickSidebarLevel';
import type { GetFn, SetFn } from './types';

export const leaveSessionLevel = (set: SetFn, get: GetFn) => {
  const pick = pickSidebarLevel(set, get);
  return (): void => pick({ level: 'workspace' });
};
