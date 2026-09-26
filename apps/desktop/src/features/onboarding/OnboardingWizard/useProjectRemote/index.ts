import { useEffect, useState } from 'react';
import type { Project } from '@goodboy/types';
import { worktreeRemoteUrl } from '../../../worktree/worktree';

type Params = {
  readonly project: Project | null;
};

export const useProjectRemote = ({ project }: Params): string | null => {
  const [url, setUrl] = useState<string | null>(null);
  const rootPath = project?.kind === 'repo' ? project.rootPath : null;

  useEffect(() => {
    if (rootPath === null) {
      setUrl(null);
      return;
    }
    let isDisposed = false;
    void worktreeRemoteUrl(rootPath)
      .then((next) => {
        if (!isDisposed) {
          setUrl(next);
        }
      })
      .catch(() => {
        if (!isDisposed) {
          setUrl(null);
        }
      });
    return () => {
      isDisposed = true;
    };
  }, [rootPath]);

  return url;
};
