import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DiffHunk, FileDiff } from '@goodboy/types';
import { worktreeDiffBody } from '../../../worktree/worktreeDiffBody';
import type { DiffBodies, DiffBodyState, DiffBodyTarget } from '../../components/DiffView/types';
import { parseDiffAsync } from '../../lib/parseDiffAsync';

type Params = {
  readonly baseFiles: ReadonlyArray<FileDiff>;
  readonly isLazy: boolean;
  readonly worktreePath: string | null;
  readonly baseBranch: string | null;
  readonly sourceKey: string;
};

type Body =
  | { readonly kind: 'loaded'; readonly hunks: ReadonlyArray<DiffHunk> }
  | { readonly kind: 'failed' };

type Merged = {
  readonly base: FileDiff;
  readonly hunks: ReadonlyArray<DiffHunk>;
  readonly file: FileDiff;
};

export type DiffBodiesState = {
  readonly files: ReadonlyArray<FileDiff>;
  readonly bodies: DiffBodies | null;
};

const NOTHING_LOADED: ReadonlyMap<string, Body> = new Map();

export const useDiffBodies = ({
  baseFiles,
  isLazy,
  worktreePath,
  baseBranch,
  sourceKey,
}: Params): DiffBodiesState => {
  const [bodyMap, setBodyMap] = useState<ReadonlyMap<string, Body>>(NOTHING_LOADED);
  const generationRef = useRef(0);
  const requestedRef = useRef(new Set<string>());
  const lastSourceRef = useRef<string | null>(null);
  const mergedRef = useRef(new Map<string, Merged>());
  const baseFilesRef = useRef(baseFiles);
  baseFilesRef.current = baseFiles;

  useEffect(() => {
    generationRef.current += 1;
    requestedRef.current = new Set();
    const isNewSource = lastSourceRef.current !== sourceKey || !isLazy;
    lastSourceRef.current = sourceKey;
    if (isNewSource) {
      setBodyMap(NOTHING_LOADED);
      mergedRef.current = new Map();
      return;
    }
    setBodyMap((previous) => new Map(previous));
  }, [baseFiles, isLazy, sourceKey]);

  const request = useCallback(
    ({ path }: DiffBodyTarget) => {
      const entry = baseFilesRef.current.find((file) => file.path === path);
      if (!isLazy || worktreePath === null || entry === undefined || entry.binary) {
        return;
      }
      if (requestedRef.current.has(path)) {
        return;
      }
      requestedRef.current.add(path);
      const stamp = generationRef.current;
      worktreeDiffBody({ worktreePath, baseBranch, path, oldPath: entry.oldPath ?? null })
        .then((raw) => parseDiffAsync({ raw }))
        .then((parsed) => {
          if (generationRef.current !== stamp) {
            return;
          }
          const parsedFile = parsed.find((file) => file.path === path) ?? parsed[0];
          setBodyMap((previous) =>
            new Map(previous).set(path, { kind: 'loaded', hunks: parsedFile?.hunks ?? [] }),
          );
        })
        .catch(() => {
          if (generationRef.current !== stamp) {
            return;
          }
          setBodyMap((previous) =>
            previous.get(path)?.kind === 'loaded'
              ? previous
              : new Map(previous).set(path, { kind: 'failed' }),
          );
        });
    },
    [baseBranch, isLazy, worktreePath],
  );

  const retry = useCallback(
    ({ path }: DiffBodyTarget) => {
      requestedRef.current.delete(path);
      setBodyMap((previous) => {
        const next = new Map(previous);
        next.delete(path);
        return next;
      });
      request({ path });
    },
    [request],
  );

  const binaryPaths = useMemo(
    () => new Set(baseFiles.filter((file) => file.binary).map((file) => file.path)),
    [baseFiles],
  );

  const bodies = useMemo<DiffBodies | null>(() => {
    if (!isLazy) {
      return null;
    }
    const stateOf = ({ path }: DiffBodyTarget): DiffBodyState => {
      if (binaryPaths.has(path)) {
        return 'loaded';
      }
      const body = bodyMap.get(path);
      return body === undefined ? 'pending' : body.kind;
    };
    return { stateOf, request, retry };
  }, [binaryPaths, bodyMap, isLazy, request, retry]);

  const files = useMemo(() => {
    if (!isLazy) {
      return baseFiles;
    }
    return baseFiles.map((base) => {
      const body = bodyMap.get(base.path);
      if (body === undefined || body.kind !== 'loaded') {
        return base;
      }
      const cached = mergedRef.current.get(base.path);
      if (cached !== undefined && cached.base === base && cached.hunks === body.hunks) {
        return cached.file;
      }
      const file: FileDiff = { ...base, hunks: body.hunks };
      mergedRef.current.set(base.path, { base, hunks: body.hunks, file });
      return file;
    });
  }, [baseFiles, bodyMap, isLazy]);

  return { files, bodies };
};
