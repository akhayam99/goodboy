import { useEffect, useState } from 'react';
import { sessionDirExists } from './worktree';

type Params = {
  readonly path: string | null;
  readonly debounceMs?: number;
};

type SimpleSessionDirectoryConflict = {
  readonly exists: boolean;
  readonly checking: boolean;
};

const DEFAULT_DEBOUNCE_MS = 250;

export const useSimpleSessionDirectoryConflict = ({
  path,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: Params): SimpleSessionDirectoryConflict => {
  const [exists, setExists] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    setExists(false);
    if (path == null || path === '') {
      setChecking(false);
      return;
    }

    let cancelled = false;
    setChecking(true);
    const timerId = window.setTimeout(() => {
      sessionDirExists({ path })
        .then((directoryExists) => {
          if (cancelled) {
            return;
          }
          setExists(directoryExists);
        })
        .catch(() => {
          if (cancelled) {
            return;
          }
          setExists(false);
        })
        .finally(() => {
          if (cancelled) {
            return;
          }
          setChecking(false);
        });
    }, debounceMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, [debounceMs, path]);

  return { exists, checking };
};
