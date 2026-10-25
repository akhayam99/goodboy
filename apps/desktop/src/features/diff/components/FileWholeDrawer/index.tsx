import { useCallback, useState } from 'react';
import { DrawerFrame } from '@goodboy/ui';
import type { DiffLayoutMode } from '../../hooks/useDiffLayoutMode/diffLayoutMode';
import { DiffLayoutToggle } from '../DiffLayoutToggle';
import type { FileDiff } from '@goodboy/types';
import type { FileDiffWhole } from '../../../../store/slices/drawer/state';
import { useDiffLayoutMode } from '../../hooks/useDiffLayoutMode';
import { fileGlyphOf } from '../../../explore/fileGlyph';
import { worktreeFileSides } from '../../../worktree/worktree';
import { splitPath } from '../../lib/fileStatus';
import { DiffView } from '../DiffView';

type Props = {
  readonly worktreePath: string;
  readonly whole: FileDiffWhole;
  readonly onClose: () => void;
};

export const FileWholeDrawer = ({ worktreePath, whole, onClose }: Props) => {
  const [pageLayout] = useDiffLayoutMode();
  const [layout, setLayout] = useState<DiffLayoutMode>(pageLayout);
  const { file, oldRev, newRev, baseBranch } = whole;
  const loadFileSides = useCallback(
    (target: FileDiff) =>
      worktreeFileSides({ worktreePath, path: target.path, oldRev, newRev, baseBranch }),
    [baseBranch, newRev, oldRev, worktreePath],
  );
  return (
    <DrawerFrame
      title={splitPath(file.path).name}
      icon={fileGlyphOf({ name: splitPath(file.path).name })}
      iconClassName="text-muted-foreground"
      onClose={onClose}
      scroll="self"
      action={<DiffLayoutToggle mode={layout} onChange={setLayout} />}
    >
      <DiffView
        files={[file]}
        presentation="peek"
        isWholeFile
        layoutOverride={layout}
        loadFileSides={loadFileSides}
      />
    </DrawerFrame>
  );
};
