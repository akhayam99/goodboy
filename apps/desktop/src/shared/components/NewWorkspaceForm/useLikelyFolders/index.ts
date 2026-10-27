import { useCallback, useEffect, useState } from 'react';
import { homeFolder } from '../../../lib/homeFolder';
import { joinPath } from '../../../lib/projectName';
import { validateGitRepo } from '../../../lib/repo';
import { currentPlatform } from '../../../platform';
import { tildePath } from '../tildePath';

type LikelyFolder = {
  readonly path: string;
  readonly label: string;
};

type Params = {
  readonly isEnabled: boolean;
};

type ToggleParams = {
  readonly path: string;
};

export type LikelyFolders = {
  readonly folders: ReadonlyArray<LikelyFolder>;
  readonly ticked: ReadonlyArray<string>;
  readonly toggle: (params: ToggleParams) => void;
  readonly clear: () => void;
};

const PARENT_NAMES: ReadonlyArray<string> = [
  'code',
  'Code',
  'dev',
  'Developer',
  'projects',
  'Projects',
  'src',
  'work',
  'repos',
  'GitHub',
];

const PROTECTED_NAMES: ReadonlyArray<string> = ['Documents'];

const NONE: ReadonlyArray<LikelyFolder> = [];

type FindParams = {
  readonly home: string;
};

const findExisting = async ({ home }: FindParams): Promise<ReadonlyArray<LikelyFolder>> => {
  const candidates = PARENT_NAMES.map((name) => joinPath({ parent: home, name }));
  const checks = await Promise.allSettled(candidates.map((path) => validateGitRepo(path)));
  const seen = new Set<string>();
  return candidates.flatMap((path, index): ReadonlyArray<LikelyFolder> => {
    const outcome = checks[index];
    if (outcome?.status !== 'fulfilled') {
      return NONE;
    }
    const { resolvedPath, errorKind } = outcome.value;
    const isReadable = errorKind === null || errorKind === 'not_a_repository';
    if (!isReadable || resolvedPath === null || seen.has(resolvedPath.toLowerCase())) {
      return NONE;
    }
    seen.add(resolvedPath.toLowerCase());
    return [{ path, label: tildePath({ path, home }) }];
  });
};

type ProtectedParams = {
  readonly home: string;
};

const protectedFolders = ({ home }: ProtectedParams): ReadonlyArray<LikelyFolder> =>
  currentPlatform() === 'darwin'
    ? PROTECTED_NAMES.map((name) => {
        const path = joinPath({ parent: home, name });
        return { path, label: tildePath({ path, home }) };
      })
    : NONE;

export const useLikelyFolders = ({ isEnabled }: Params): LikelyFolders => {
  const [folders, setFolders] = useState<ReadonlyArray<LikelyFolder>>(NONE);
  const [ticked, setTicked] = useState<ReadonlyArray<string>>([]);

  useEffect(() => {
    if (!isEnabled) {
      return;
    }
    let isDisposed = false;
    void homeFolder().then(async (home) => {
      if (home === null) {
        return;
      }
      const existing = await findExisting({ home });
      if (!isDisposed) {
        setFolders([...existing, ...protectedFolders({ home })]);
      }
    });
    return () => {
      isDisposed = true;
    };
  }, [isEnabled]);

  const toggle = useCallback(({ path }: ToggleParams) => {
    setTicked((current) =>
      current.includes(path) ? current.filter((entry) => entry !== path) : [...current, path],
    );
  }, []);

  const clear = useCallback(() => setTicked([]), []);

  return { folders, ticked, toggle, clear };
};
