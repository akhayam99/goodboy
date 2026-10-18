import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Button,
  DrawerFrame,
  EmptyState,
  PAGE_MEASURE,
  PageColumn,
  PaneActionsContext,
  PaneShell,
  RefreshIconButton,
  SegmentedTabs,
  Skeleton,
} from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { StudioCloseButton } from '../../../../shared/components/StudioShell/StudioCloseButton';
import { useNow } from '../../../../shared/hooks/useNow';
import { useAppStore } from '../../../../store';
import { selectOpenDrawer } from '../../../../store/slices/drawer/selectOpenDrawer';
import { changedExpandedOf, changedListingOf } from '../../exploreChanges';
import type { LoadFolderParams, SelectFileParams, SetExpandedParams } from '../../exploreHandlers';
import { exploreMetaOf } from '../../exploreMeta';
import { EXPLORE_ROOT_PATH, ancestorPathsOf } from '../../exploreRows';
import { useExploreChanges } from '../../hooks/useExploreChanges';
import { useExploreListing } from '../../hooks/useExploreListing';
import { useExploreRoot } from '../../hooks/useExploreRoot';
import { ExploreNoFolder } from './ExploreNoFolder';
import { ExploreProjectChip } from './ExploreProjectChip';
import { ExploreTree } from './ExploreTree';

type Props = {
  readonly sessionId: SessionId;
  readonly noFolderAction?: ReactNode;
  readonly onClose: () => void;
};

const GONE_SENTENCE = 'Closed. Its files were removed.';

const NO_EXPANDED: Readonly<Record<string, boolean>> = Object.freeze({});

type ExploreMode = 'all' | 'changed';

type ChangedView = {
  readonly mountPath: string | null;
  readonly mode: ExploreMode;
  readonly collapsed: Readonly<Record<string, boolean>>;
};

const FRESH_VIEW: ChangedView = { mountPath: null, mode: 'all', collapsed: NO_EXPANDED };

export const ExplorePane = ({ sessionId, noFolderAction, onClose }: Props) => {
  const now = useNow(30_000);
  const root = useExploreRoot({ sessionId });
  const { target } = root;
  const sessionDir =
    target.kind === 'mount' || target.kind === 'root' || target.kind === 'scratch'
      ? target.path
      : null;
  const { listing, load, reload } = useExploreListing({ sessionDir });
  const changesMountPath = target.kind === 'mount' ? target.path : null;
  const changesView = useExploreChanges({ sessionId, mountPath: changesMountPath });
  const { changes } = changesView;
  const [storedView, setStoredView] = useState<ChangedView>(FRESH_VIEW);
  const view = storedView.mountPath === changesMountPath ? storedView : FRESH_VIEW;
  const isChangedMode = view.mode === 'changed' && changesView.isAvailable;
  const changedListing = useMemo(() => changedListingOf({ changes, listing }), [changes, listing]);
  const changedExpanded = useMemo(
    () => changedExpandedOf({ listing: changedListing, collapsed: view.collapsed }),
    [changedListing, view.collapsed],
  );
  const expanded = useAppStore(
    (state) => state.exploreExpanded[sessionId]?.[sessionDir ?? ''] ?? NO_EXPANDED,
  );
  const setExploreExpanded = useAppStore((state) => state.setExploreExpanded);
  const toggleDrawer = useAppStore((state) => state.toggleDrawer);
  const selectedRelPath = useAppStore((state) => {
    const drawer = selectOpenDrawer(state);
    if (
      drawer === null ||
      drawer.kind !== 'explore-file' ||
      drawer.sessionId !== sessionId ||
      drawer.payload.sessionDir !== sessionDir
    ) {
      return null;
    }
    return drawer.payload.entry.relPath;
  });

  useEffect(() => {
    if (selectedRelPath === null || sessionDir === null) {
      return;
    }
    const open = useAppStore.getState().exploreExpanded[sessionId]?.[sessionDir] ?? NO_EXPANDED;
    for (const path of ancestorPathsOf({ relPath: selectedRelPath })) {
      if (open[path] !== true) {
        setExploreExpanded({ sessionId, mountPath: sessionDir, path, isExpanded: true });
      }
    }
  }, [selectedRelPath, sessionDir, sessionId, setExploreExpanded]);

  const handleSetExpanded = useCallback(
    ({ path, isExpanded }: SetExpandedParams) => {
      if (sessionDir === null) {
        return;
      }
      if (isChangedMode) {
        setStoredView({
          ...view,
          mountPath: changesMountPath,
          collapsed: { ...view.collapsed, [path]: !isExpanded },
        });
        return;
      }
      setExploreExpanded({ sessionId, mountPath: sessionDir, path, isExpanded });
    },
    [sessionDir, sessionId, setExploreExpanded, isChangedMode, view, changesMountPath],
  );

  const handleModeChange = (mode: ExploreMode) =>
    setStoredView({ mountPath: changesMountPath, mode, collapsed: NO_EXPANDED });

  const handleSelectFile = useCallback(
    ({ entry }: SelectFileParams) => {
      if (entry.isDir || sessionDir === null || sessionDir.trim() === '') {
        return;
      }
      if (changes.byPath.get(entry.relPath)?.status === 'deleted') {
        return;
      }
      toggleDrawer({
        kind: 'explore-file',
        sessionId,
        payload: { sessionDir, entry, from: 'explore' },
      });
    },
    [sessionDir, sessionId, toggleDrawer, changes],
  );

  const handleLoad = useCallback(({ relPath }: LoadFolderParams) => void load({ relPath }), [load]);

  const handleRefresh = () => {
    const open = Object.keys(expanded).filter((path) => expanded[path] === true);
    reload({ relPaths: [EXPLORE_ROOT_PATH, ...open] });
    changesView.refresh();
  };

  const baseBranch = changesView.baseBranch ?? 'main';
  const rootEntries = listing.entriesByPath[EXPLORE_ROOT_PATH];
  const isRootLoading = listing.loadingByPath[EXPLORE_ROOT_PATH] === true;
  const rootError = listing.errorByPath[EXPLORE_ROOT_PATH] ?? null;

  const renderBody = () => {
    if (root.isResolving) {
      return <Skeleton className="h-6 w-full rounded-md" />;
    }
    if (target.kind === 'none') {
      return <ExploreNoFolder action={noFolderAction} />;
    }
    if (target.kind === 'gone') {
      return (
        <EmptyState
          size="page"
          icon={CONCEPT_ICONS.explore}
          title="This worktree is gone"
          description={GONE_SENTENCE}
          action={
            root.rowCount > 0 ? (
              <Button size="sm" variant="ghost" onClick={() => root.pick({ mountPath: null })}>
                Show the current folder
              </Button>
            ) : undefined
          }
        />
      );
    }
    if (isChangedMode) {
      if (changes.count === 0) {
        return (
          <EmptyState
            size="page"
            icon={CONCEPT_ICONS.explore}
            title={`No changes against ${baseBranch}`}
            description={`Files that differ from ${baseBranch} appear here.`}
          />
        );
      }
      return (
        <ExploreTree
          key={`${sessionId}:${sessionDir}:changed`}
          sessionId={sessionId}
          sessionDir={sessionDir ?? ''}
          listing={changedListing}
          expanded={changedExpanded}
          selectedRelPath={selectedRelPath}
          now={now}
          changes={changes}
          onSetExpanded={handleSetExpanded}
          onLoad={handleLoad}
          onSelectFile={handleSelectFile}
        />
      );
    }
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
          size="page"
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
          size="page"
          icon={CONCEPT_ICONS.explore}
          title="This folder is empty"
          description="Files that agents write here show up as soon as they are saved."
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
        changes={changes}
        onSetExpanded={handleSetExpanded}
        onLoad={handleLoad}
        onSelectFile={handleSelectFile}
      />
    );
  };

  const hasTabs =
    target.kind === 'mount' &&
    changesView.isAvailable &&
    (changes.count > 0 || view.mode === 'changed');

  const toolbar =
    target.kind === 'none' ? undefined : (
      <div className="flex w-full min-w-0 items-center justify-between gap-3">
        <ExploreProjectChip target={target} groups={root.groups} rowCount={root.rowCount} />
        {hasTabs ? (
          <SegmentedTabs
            ariaLabel="Files shown"
            size="xs"
            value={view.mode}
            options={[
              { value: 'all', label: 'All files' },
              { value: 'changed', label: 'Changed', badge: changes.count },
            ]}
            onChange={handleModeChange}
          />
        ) : null}
      </div>
    );

  const meta = exploreMetaOf({ isChangedMode, entries: rootEntries, changeCount: changes.count });

  return (
    <DrawerFrame title="Explore" isHeaderless onClose={onClose}>
      <PaneActionsContext.Provider value={<StudioCloseButton label="Close" onClose={onClose} />}>
        <PaneShell
          page="explore"
          scroll="self"
          title="Explore"
          meta={meta ?? undefined}
          tabs={toolbar}
          actions={
            sessionDir === null ? undefined : (
              <RefreshIconButton
                label="Refresh the files"
                isLoading={isRootLoading}
                onClick={handleRefresh}
              />
            )
          }
        >
          <PageColumn width={PAGE_MEASURE.explore} className="flex min-h-0 flex-1 flex-col pb-2">
            {renderBody()}
          </PageColumn>
        </PaneShell>
      </PaneActionsContext.Provider>
    </DrawerFrame>
  );
};
