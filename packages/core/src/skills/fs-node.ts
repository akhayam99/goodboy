import { readdir, readFile, access } from 'node:fs/promises';
import type { SkillFs } from './registry';

export const nodeSkillFs: SkillFs = {
  async readDir(path: string): Promise<string[]> {
    return readdir(path);
  },

  async readFile(path: string): Promise<string> {
    return readFile(path, 'utf8');
  },

  async stat(path: string): Promise<{ exists: boolean }> {
    try {
      await access(path);
      return { exists: true };
    } catch {
      return { exists: false };
    }
  },
};
