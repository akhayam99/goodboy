import { useState } from 'react';
import { File } from 'lucide-react';
import { DrawerFrame } from '@goodboy/ui';
import { exploreOpen, type ExploreEntry } from '../../explore';
import { useExplorePreview } from '../../hooks/useExplorePreview';
import { ExplorePreviewPanel } from '../ExplorePane/ExplorePreviewPanel';

type Props = {
  readonly sessionDir: string;
  readonly entry: ExploreEntry;
  readonly onClose: () => void;
};

const joinPath = ({ root, relPath }: { readonly root: string; readonly relPath: string }) => {
  if (relPath === '') {
    return root;
  }
  if (root.endsWith('/') || root.endsWith('\\')) {
    return `${root}${relPath}`;
  }
  return `${root}/${relPath}`;
};

export const ExploreFileDrawer = ({ sessionDir, entry, onClose }: Props) => {
  const previewState = useExplorePreview({ sessionDir, entry });
  const [openError, setOpenError] = useState<string | null>(null);

  const openOutside = () => {
    exploreOpen({ sessionDir, relPath: entry.relPath, reveal: false })
      .then(() => setOpenError(null))
      .catch((error: unknown) => {
        const reason = error instanceof Error ? error.message : 'Unknown error';
        setOpenError(`Could not open "${entry.name}". ${reason}`);
      });
  };

  return (
    <DrawerFrame
      title={entry.name}
      icon={File}
      iconClassName="text-muted-foreground"
      closeLabel={`Close preview for ${entry.name}`}
      onClose={onClose}
    >
      <ExplorePreviewPanel
        entry={entry}
        previewState={previewState}
        absolutePath={joinPath({ root: sessionDir, relPath: entry.relPath })}
        openError={openError}
        onOpenOutside={openOutside}
      />
    </DrawerFrame>
  );
};
