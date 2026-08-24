import { useState } from 'react';
import { scanChildRepos, validateGitRepo, type ChildRepo } from '../../lib/repo';

export type DetectedChildRepos = {
  readonly parentPath: string;
  readonly repos: ReadonlyArray<ChildRepo>;
};

type DetectParams = {
  readonly path: string;
};

export const useChildRepoDetection = () => {
  const [detected, setDetected] = useState<DetectedChildRepos | null>(null);

  const detect = async ({ path }: DetectParams): Promise<boolean> => {
    setDetected(null);
    const check = await validateGitRepo(path);
    if (check.isRepo && check.rootPath != null && check.rootPath !== '') {
      return false;
    }
    const parentPath = check.resolvedPath ?? path;
    const repos = await scanChildRepos({ path: parentPath });
    if (repos.length === 0) {
      return false;
    }
    setDetected({ parentPath, repos });
    return true;
  };

  const clear = () => setDetected(null);

  return { detected, detect, clear };
};
