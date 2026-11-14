import { useCallback, useEffect, useMemo, type ReactNode } from 'react';
import {
  Button,
  DrawerFrame,
  EmptyState,
  Notice,
  RefreshIconButton,
  Skeleton,
  Switch,
} from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { useNow } from '../../../../shared/hooks/useNow';
import { useAppStore } from '../../../../store';
import { selectOpenDrawer } from '../../../../store/slices/drawer/selectOpenDrawer';
import { changedExpandedOf, changedListingOf } from '../../exploreChanges';
import type { LoadFolderParams, SelectFileParams, SetExpandedParams } from '../../exploreHandlers';
import { exploreMetaOf } from '../../exploreMeta';
import { EXPLORE_ROOT_PATH, ancestorPathsOf } from '../../exploreRows';
import { useExploreChanges } from '../../hooks/useExploreChanges';
import { useExploreChangedView } from '../../hooks/useExploreChangedView';
import { useExploreListing } from '../../../diff/FilesMode/useExploreListing';
import { useExploreRoot } from '../../../diff/FilesMode/useExploreRoot';
import { ExploreNoFolder } from './ExploreNoFolder';
import { ExploreProjectChip } from '../../../diff/FilesMode/ExploreProjectChip';
import { ExploreTree } from './ExploreTree';

type Props = {
  readonly sessionId: SessionId;
  readonly noFolderAction?: ReactNode;
  readonly onClose: () => void;
};

const GONE_SENTENCE = 'Closed. Its files were removed.';

const NO_EXPANDED: Readonly<Record<string, boolean>> = Object.freeze({});

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
  const { view, isChangedMode, setChangedOnly, setExpanded } = useExploreChangedView({
    sessionId,
    mountPath: changesMountPath,
    isAvailable: changesView.isAvailable,
  });
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
        setExpanded({ path, isExpanded });
        return;
      }
      setExploreExpanded({ sessionId, mountPath: sessionDir, path, isExpanded });
    },
    [sessionDir, sessionId, setExploreExpanded, setExpanded, isChangedMode],
  );

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
            description={`Files that differ from ${baseBranch} are listed when they change.`}
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
        <Notice
          tone="danger"
          placement="inline"
          role="alert"
          title="Couldn't read this folder"
          body="Goodboy couldn't list its files."
          detail={rootError}
          actions={
            <Button
              variant="secondary"
              size="sm"
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
          title="Nothing here yet"
          description="Agents write files as they work."
          action={
            <Button size="sm" variant="ghost" onClick={handleRefresh}>
              Refresh
            </Button>
          }
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

  const hasToggle =
    target.kind === 'mount' &&
    changesView.isAvailable &&
    (changes.count > 0 || view.mode === 'changed');

  const toolbar =
    target.kind === 'none' ? undefined : (
      <div className="flex w-full min-w-0 items-center justify-between gap-3">
        <ExploreProjectChip target={target} groups={root.groups} rowCount={root.rowCount} />
        {hasToggle ? (
          <Switch
            label="Changed only"
            checked={isChangedMode}
            onChange={(isChangedOnly) => setChangedOnly({ isChangedOnly })}
          />
        ) : null}
      </div>
    );

  const meta = exploreMetaOf({ changeCount: changes.count });

  return (
    <DrawerFrame
      title="Explore"
      icon={CONCEPT_ICONS.explore}
      iconClassName="text-faint-foreground"
      meta={meta ?? undefined}
      action={
        sessionDir === null ? undefined : (
          <RefreshIconButton
            label="Refresh the files"
            isLoading={isRootLoading}
            onClick={handleRefresh}
          />
        )
      }
      toolbar={toolbar}
      scroll="self"
      onClose={onClose}
    >
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">{renderBody()}</div>
    </DrawerFrame>
  );
};
