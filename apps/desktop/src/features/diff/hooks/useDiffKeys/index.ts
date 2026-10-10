import { useCallback, useMemo } from 'react';
import { useShortcut } from '../../../../shared/keyboard/useShortcut';
import { ancestorIds } from '../../lib/changeTree';
import { nextUnviewedPath, stepPath } from '../../lib/fileOrder';
import type { ReviewState } from '../useReviewState';

type DiffKeysReview = Pick<
  ReviewState,
  'tree' | 'activePath' | 'collapsed' | 'toggleFolder' | 'jumpTo' | 'stepTo' | 'viewed'
>;

type Params = {
  readonly enabled: boolean;
  readonly review: DiffKeysReview;
  readonly onToggleTree: () => void;
  readonly onFocusTree: () => void;
  readonly onFocusFilter: () => void;
};

export const useDiffKeys = ({
  enabled,
  review,
  onToggleTree,
  onFocusTree,
  onFocusFilter,
}: Params): void => {
  const { tree, activePath, collapsed, toggleFolder, jumpTo, stepTo, viewed } = review;
  const order = useMemo(() => tree.files.map((file) => file.path), [tree.files]);

  const move = useCallback(
    (delta: 1 | -1) => {
      const target = stepPath({
        order,
        from: activePath,
        delta,
        accepts: () => true,
      });
      if (target !== null) {
        stepTo(target);
      }
    },
    [activePath, order, stepTo],
  );

  const goToUnviewed = useCallback(() => {
    const target = nextUnviewedPath({
      files: tree.files,
      from: activePath,
      stateOf: viewed.stateOf,
      wrap: true,
    });
    if (target !== null) {
      jumpTo(target);
    }
  }, [activePath, jumpTo, tree.files, viewed.stateOf]);

  const markViewed = useCallback(() => {
    const current = tree.files.find((file) => file.path === activePath);
    if (current !== undefined && viewed.stateOf(current) !== 'viewed') {
      viewed.onToggle(current, true);
    }
    goToUnviewed();
  }, [activePath, goToUnviewed, tree.files, viewed]);

  const closeFolder = useCallback(() => {
    if (activePath === null) {
      return;
    }
    const [parent] = ancestorIds({ rows: tree.rows, path: activePath });
    if (parent !== undefined && !collapsed.has(parent)) {
      toggleFolder(parent);
    }
  }, [activePath, collapsed, toggleFolder, tree.rows]);

  const openFolder = useCallback(() => {
    if (activePath === null) {
      return;
    }
    for (const id of ancestorIds({ rows: tree.rows, path: activePath })) {
      if (collapsed.has(id)) {
        toggleFolder(id);
      }
    }
  }, [activePath, collapsed, toggleFolder, tree.rows]);

  const down = useCallback(() => move(1), [move]);
  const up = useCallback(() => move(-1), [move]);

  useShortcut('diff.fileDown', down, enabled);
  useShortcut('diff.nextFile', down, enabled);
  useShortcut('diff.fileUp', up, enabled);
  useShortcut('diff.previousFile', up, enabled);
  useShortcut('diff.closeFolder', closeFolder, enabled);
  useShortcut('diff.openFolder', openFolder, enabled);
  useShortcut('diff.markViewed', markViewed, enabled);
  useShortcut('diff.nextUnviewed', goToUnviewed, enabled);
  useShortcut('diff.focusTree', onFocusTree, enabled);
  useShortcut('diff.focusFilter', onFocusFilter, enabled);
  useShortcut('diff.focusFilterAlias', onFocusFilter, enabled);
  useShortcut('diff.toggleTree', onToggleTree, enabled);
};
