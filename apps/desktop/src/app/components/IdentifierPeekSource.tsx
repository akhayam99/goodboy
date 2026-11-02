import { useMemo } from 'react';
import { Notice } from '@goodboy/ui';
import { ExplorePreviewPanel } from '../../features/explore/components/ExplorePane/ExplorePreviewPanel';
import { useExplorePreview } from '../../features/explore/hooks/useExplorePreview';
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
      sizeBytes: 0,
      modifiedAt: null,
    }),
    [path],
  );
  const previewState = useExplorePreview({ sessionDir: worktreePath, entry });
  const previewKind = previewKindOf({ entry, previewState });
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="px-4">
        <Notice
          tone="info"
          placement="inline"
          title="No changes on this branch"
          detail="This file is shown as it is in the working tree."
        />
      </div>
      <ExplorePreviewPanel
        key={path}
        entry={entry}
        previewState={previewState}
        previewKind={previewKind}
        view="source"
        isWrapped={false}
        line={line}
      />
    </div>
  );
};
