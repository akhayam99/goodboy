import { useState } from 'react';
import { ArrowUpRight, File } from 'lucide-react';
import { Button, DrawerFrame, SegmentedTabs } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { selectMountForPath } from '../../../store/slices/project-mounts/selectors';
import { ICON_SIZE } from '../../../shared/components/conceptIcons';
import type { ExploreEntry } from '../explore';
import type { ExploreOpenFailure } from '../openFailure';
import { useExploreChanges } from '../hooks/useExploreChanges';
import { useExploreOpen } from '../hooks/useExploreOpen';
import { useExplorePreview } from '../hooks/useExplorePreview';
import { ExploreFileChanges } from './ExploreFileChanges';
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
  const [view, setView] = useState<'preview' | 'changes'>('preview');
  const isMount = useAppStore(
    (state) => selectMountForPath({ state, sessionId, path: sessionDir }) !== null,
  );
  const { changes, baseBranch } = useExploreChanges({
    sessionId,
    mountPath: isMount ? sessionDir : null,
  });
  const openMountDiff = useAppStore((state) => state.openMountDiff);
  const setDiffFocus = useAppStore((state) => state.setDiffFocus);
  const change = changes.byPath.get(entry.relPath) ?? null;
  const hasChanges = change !== null && change.status !== 'deleted';
  const isChangesView = hasChanges && view === 'changes';

  const open = () => {
    void exploreOpen.run({ entry, isReveal: false }).then(setOpenFailure);
  };

  const openInFiles = () => {
    openMountDiff(sessionId, sessionDir);
    setDiffFocus(sessionId, { kind: 'branch', path: entry.relPath });
  };

  return (
    <DrawerFrame
      title={entry.name}
      icon={File}
      iconClassName="text-muted-foreground"
      onClose={onClose}
      scroll={isChangesView ? 'self' : 'frame'}
      toolbar={
        hasChanges ? (
          <SegmentedTabs
            ariaLabel="File view"
            size="xs"
            value={view}
            options={[
              { value: 'preview', label: 'Preview' },
              { value: 'changes', label: 'Changes' },
            ]}
            onChange={setView}
          />
        ) : undefined
      }
      action={
        isChangesView ? (
          <Button variant="ghost" size="sm" onClick={openInFiles}>
            Open in Files
            <ArrowUpRight size={ICON_SIZE.row} aria-hidden />
          </Button>
        ) : undefined
      }
    >
      {isChangesView ? (
        <ExploreFileChanges
          sessionDir={sessionDir}
          relPath={entry.relPath}
          baseBranch={baseBranch}
        />
      ) : (
        <ExplorePreviewPanel
          entry={entry}
          previewState={previewState}
          absolutePath={joinPath({ root: sessionDir, relPath: entry.relPath })}
          openAction={exploreOpen.actionOf({ entry })}
          openFailure={openFailure}
          onOpen={open}
        />
      )}
    </DrawerFrame>
  );
};
