import { useState } from 'react';
import { File } from 'lucide-react';
import { DrawerFrame } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import type { ExploreEntry } from '../explore';
import type { ExploreOpenFailure } from '../openFailure';
import { useExploreOpen } from '../hooks/useExploreOpen';
import { useExplorePreview } from '../hooks/useExplorePreview';
import { ExplorePreviewPanel } from './ExplorePane/ExplorePreviewPanel';

type Props = {
  readonly sessionId: SessionId;
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

export const ExploreFileDrawer = ({ sessionId, sessionDir, entry, onClose }: Props) => {
  const previewState = useExplorePreview({ sessionDir, entry });
  const exploreOpen = useExploreOpen({ sessionId, sessionDir });
  const [openFailure, setOpenFailure] = useState<ExploreOpenFailure | null>(null);

  const open = () => {
    void exploreOpen.run({ entry, isReveal: false }).then(setOpenFailure);
  };

  return (
    <DrawerFrame
      title={entry.name}
      icon={File}
      iconClassName="text-muted-foreground"
      onClose={onClose}
    >
      <ExplorePreviewPanel
        entry={entry}
        previewState={previewState}
        absolutePath={joinPath({ root: sessionDir, relPath: entry.relPath })}
        openAction={exploreOpen.actionOf({ entry })}
        openFailure={openFailure}
        onOpen={open}
      />
    </DrawerFrame>
  );
};
