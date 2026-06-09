import { ghStatus } from '../../../features/github/github';
import type { SetFn } from './types';

export const refreshGithubStatus = (set: SetFn) => {
  return async () => {
    try {
      const status = await ghStatus();
      set({ githubStatus: status });
    } catch (err) {
      set({
        githubStatus: {
          available: false,
          mode: 'absent',
          version: undefined,
          user: undefined,
          scopes: [],
        },
      });
      console.warn('gh_status failed', err);
    }
  };
};
