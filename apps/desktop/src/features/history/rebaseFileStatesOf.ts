import type { RebaseConflictFile } from '../worktree/worktree';

export type RebaseFileState = {
  readonly path: string;
  readonly isResolved: boolean;
  readonly isWorking: boolean;
};

export type RebaseFileStates = {
  readonly files: ReadonlyArray<RebaseFileState>;
  readonly total: number;
  readonly left: number;
  readonly resolved: number;
  readonly toStage: number;
  readonly isKnown: boolean;
};

type Params = {
  readonly files: ReadonlyArray<string>;
  readonly conflicts: ReadonlyArray<RebaseConflictFile> | null;
  readonly isAutoWorking: boolean;
};

export const rebaseFileStatesOf = ({
  files,
  conflicts,
  isAutoWorking,
}: Params): RebaseFileStates => {
  const pending = new Set(
    (conflicts ?? [])
      .filter((file) => file.hasMarkers || file.isStageOnly)
      .map((file) => file.path),
  );
  const toStage = (conflicts ?? []).filter((file) => !file.hasMarkers && file.isStageOnly).length;
  const extra = (conflicts ?? []).map((file) => file.path).filter((path) => !files.includes(path));
  const states = [...files, ...extra].map((path): RebaseFileState => {
    const isResolved = conflicts !== null && !pending.has(path);
    return { path, isResolved, isWorking: isAutoWorking && !isResolved };
  });
  const left = states.filter((file) => !file.isResolved).length;
  return {
    files: states,
    total: states.length,
    left,
    resolved: states.length - left,
    toStage,
    isKnown: conflicts !== null,
  };
};
