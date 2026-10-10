import { useCallback } from 'react';
import {
  Button,
  EmptyState,
  PageColumn,
  PaneShell,
  RefreshIconButton,
  Skeleton,
} from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { useNow } from '../../../../shared/hooks/useNow';
import { useAppStore } from '../../../../store';
import { selectOpenDrawer } from '../../../../store/slices/drawer/selectOpenDrawer';
import type { LoadFolderParams, SelectFileParams, SetExpandedParams } from '../../exploreHandlers';
import { EXPLORE_ROOT_PATH } from '../../exploreRows';
import { useExploreListing } from '../../hooks/useExploreListing';
import { ExploreTree } from './ExploreTree';

type Props = {
  readonly sessionId: SessionId;
  readonly sessionDir: string | null;
};

const NO_EXPANDED: Readonly<Record<string, boolean>> = Object.freeze({});

export const ExplorePane = ({ sessionId, sessionDir }: Props) => {
  const now = useNow(30_000);
  const { listing, load, reload } = useExploreListing({ sessionDir });
  const expanded = useAppStore((state) => state.exploreExpanded[sessionId] ?? NO_EXPANDED);
  const setExploreExpanded = useAppStore((state) => state.setExploreExpanded);
  const toggleDrawer = useAppStore((state) => state.toggleDrawer);
  const selectedRelPath = useAppStore((state) => {
    const drawer = selectOpenDrawer(state);
    if (drawer === null || drawer.kind !== 'explore-file' || drawer.sessionId !== sessionId) {
      return null;
    }
    return drawer.payload.entry.relPath;
  });

  const handleSetExpanded = useCallback(
    ({ path, isExpanded }: SetExpandedParams) =>
      setExploreExpanded({ sessionId, path, isExpanded }),
    [sessionId, setExploreExpanded],
  );

  const handleSelectFile = useCallback(
    ({ entry }: SelectFileParams) => {
      if (entry.isDir || sessionDir === null || sessionDir.trim() === '') {
        return;
      }
      toggleDrawer({ kind: 'explore-file', sessionId, payload: { sessionDir, entry } });
    },
    [sessionDir, sessionId, toggleDrawer],
  );

  const handleLoad = useCallback(({ relPath }: LoadFolderParams) => void load({ relPath }), [load]);

  const handleRefresh = () => {
    const open = Object.keys(expanded).filter((path) => expanded[path] === true);
    reload({ relPaths: [EXPLORE_ROOT_PATH, ...open] });
  };

  const rootEntries = listing.entriesByPath[EXPLORE_ROOT_PATH];
  const isRootLoading = listing.loadingByPath[EXPLORE_ROOT_PATH] === true;
  const rootError = listing.errorByPath[EXPLORE_ROOT_PATH] ?? null;

  const renderBody = () => {
    if (isRootLoading && rootEntries === undefined) {
      return (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-6 w-full rounded-md" />
          <Skeleton className="h-6 w-11/12 rounded-md" />
          <Skeleton className="h-6 w-10/12 rounded-md" />
        </div>
      );
    }
    if (rootError !== null) {
      return (
        <EmptyState
          size="section"
          tone={CONCEPT_TONE.explore}
          icon={CONCEPT_ICONS.explore}
          title="Couldn't read this session folder"
          description={rootError}
          action={
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleLoad({ relPath: EXPLORE_ROOT_PATH })}
            >
              Retry
            </Button>
          }
        />
      );
    }
    if (rootEntries === undefined || rootEntries.length === 0) {
      return (
        <EmptyState
          size="section"
          tone={CONCEPT_TONE.explore}
          icon={CONCEPT_ICONS.explore}
          title="This folder is empty"
        />
      );
    }
    return (
      <ExploreTree
        key={`${sessionId}:${sessionDir}`}
        sessionId={sessionId}
        sessionDir={sessionDir ?? ''}
        listing={listing}
        expanded={expanded}
        selectedRelPath={selectedRelPath}
        now={now}
        onSetExpanded={handleSetExpanded}
        onLoad={handleLoad}
        onSelectFile={handleSelectFile}
      />
    );
  };

  return (
    <PaneShell
      title="Explore"
      scroll="self"
      actions={
        <RefreshIconButton
          label="Refresh the files"
          isLoading={isRootLoading}
          onClick={handleRefresh}
        />
      }
    >
      <PageColumn className="flex min-h-0 flex-1 flex-col pb-5">{renderBody()}</PageColumn>
    </PaneShell>
  );
};
