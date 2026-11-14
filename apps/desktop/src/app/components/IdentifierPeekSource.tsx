import { useMemo } from 'react';
import { Info } from 'lucide-react';
import { EmptyLine } from '@goodboy/ui';
import { ExplorePreviewPanel } from '../../features/explore/components/ExplorePane/ExplorePreviewPanel';
import { useExplorePreview } from '../../features/diff/FilesMode/useExplorePreview';
import { previewKindOf } from '../../features/explore/previewKindOf';
import { splitPath } from '../../features/diff/lib/fileStatus';

type Props = {
  readonly worktreePath: string;
  readonly path: string;
  readonly line: number;
};

export const IdentifierPeekSource = ({ worktreePath, path, line }: Props) => {
  const entry = useMemo(
    () => ({
      name: splitPath(path).name,
      relPath: path,
      isDir: false,
      sizeBytes: null,
      modifiedAt: null,
    }),
    [path],
  );
  const previewState = useExplorePreview({ sessionDir: worktreePath, entry });
  const previewKind = previewKindOf({ entry, previewState });
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <EmptyLine icon={Info} className="px-4 pt-3">
        No changes on this branch
      </EmptyLine>
      <ExplorePreviewPanel
        key={path}
        entry={entry}
        previewState={previewState}
        previewKind={previewKind}
        view="source"
        isWrapped={false}
        line={line}
        shouldShowName
      />
    </div>
  );
};
