import { ghClearToken } from '../../../features/github/github';
import type { GetFn, SetFn } from './types';

export const clearGithubToken = (_set: SetFn, get: GetFn) => {
  return async () => {
    await ghClearToken();
    await get().refreshGithubStatus();
  };
};
