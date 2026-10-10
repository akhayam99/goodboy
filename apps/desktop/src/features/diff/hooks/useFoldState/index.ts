import { useCallback, useMemo, useRef, useState } from 'react';
import type { FileDiff, MountId, SessionId } from '@goodboy/types';
import { buildChangeTree, defaultCollapsed } from '../../lib/changeTree';
import {
  foldKeyOf,
  isFoldedIn,
  prunedFolds,
  readFolds,
  withFold,
  writeFolds,
  type Folds,
} from './foldStorage';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
  readonly files: ReadonlyArray<FileDiff>;
};

type Edit = {
  readonly key: string;
  readonly folds: Folds;
};

export type FoldState = {
  readonly collapsed: ReadonlySet<string>;
  readonly toggleFolder: (id: string) => void;
  readonly openFolders: (ids: ReadonlyArray<string>) => void;
};

export const useFoldState = ({ sessionId, mountId, files }: Params): FoldState => {
  const key = foldKeyOf({ sessionId, mountId });
  const folderTree = useMemo(() => buildChangeTree({ files }), [files]);
  const kindTree = useMemo(() => buildChangeTree({ files, group: 'kind' }), [files]);
  const defaults = useMemo(() => defaultCollapsed({ tree: folderTree }), [folderTree]);
  const validIds = useMemo(
    () =>
      new Set(
        [...folderTree.rows, ...kindTree.rows]
          .filter((row) => row.kind === 'folder')
          .map((row) => row.id),
      ),
    [folderTree, kindTree],
  );
  const stored = useMemo(() => readFolds({ key }), [key]);
  const [edit, setEdit] = useState<Edit | null>(null);
  const folds = edit !== null && edit.key === key ? edit.folds : stored;
  const latest = useRef(folds);
  latest.current = folds;

  const collapsed = useMemo(() => {
    const next = new Set(defaults);
    for (const id of folds.closed) {
      if (validIds.has(id)) {
        next.add(id);
      }
    }
    for (const id of folds.opened) {
      next.delete(id);
    }
    return next;
  }, [defaults, folds, validIds]);

  const commit = useCallback(
    (next: Folds) => {
      const pruned = prunedFolds({ folds: next, validIds });
      latest.current = pruned;
      setEdit({ key, folds: pruned });
      writeFolds({ key, folds: pruned });
    },
    [key, validIds],
  );

  const toggleFolder = useCallback(
    (id: string) => {
      const isFolded = isFoldedIn({ folds: latest.current, defaults, id });
      commit(
        withFold({
          folds: latest.current,
          id,
          shouldClose: !isFolded,
          isDefault: defaults.has(id),
        }),
      );
    },
    [commit, defaults],
  );

  const openFolders = useCallback(
    (ids: ReadonlyArray<string>) => {
      const folded = ids.filter((id) => isFoldedIn({ folds: latest.current, defaults, id }));
      if (folded.length === 0) {
        return;
      }
      commit(
        folded.reduce(
          (current, id) =>
            withFold({ folds: current, id, shouldClose: false, isDefault: defaults.has(id) }),
          latest.current,
        ),
      );
    },
    [commit, defaults],
  );

  return { collapsed, toggleFolder, openFolders };
};
