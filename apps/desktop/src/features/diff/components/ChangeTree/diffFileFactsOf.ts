import type { FileDiff } from '@goodboy/types';
import type { DiffFileFacts } from '../../../actions/kinds/diffFile';
import type { DiffFileActions } from '../DiffView/types';

type Params = {
  readonly file: FileDiff;
  readonly fileActions: DiffFileActions | null;
};

export const diffFileFactsOf = ({ file, fileActions }: Params): DiffFileFacts => {
  const openInEditor = fileActions?.onOpenInEditor ?? null;
  const showWhole = fileActions?.onShowWhole ?? null;
  return {
    path: file.path,
    onOpenInEditor: openInEditor === null ? null : () => openInEditor(file.path),
    onShowWhole: showWhole === null || file.binary ? null : () => showWhole(file),
  };
};
