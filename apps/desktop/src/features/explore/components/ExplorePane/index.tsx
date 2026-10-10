import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, File, Folder, FolderOpen } from 'lucide-react';
import { Button, cn, IconButton, Skeleton, PaneShell, EmptyState } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { exploreList, type ExploreEntry } from '../../explore';
import type { ExploreOpenFailure } from '../../openFailure';
import { useExploreOpen } from '../../hooks/useExploreOpen';
import { ExploreOpenError } from '../ExploreOpenError';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import { CONCEPT_ICONS, CONCEPT_TONE, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { RefreshIconButton } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { selectOpenDrawer } from '../../../../store/slices/drawer/selectOpenDrawer';
import { ExploreSpawnPopover } from './ExploreSpawnPopover';
import { formatBytes } from '../../../../shared/utils/formatBytes';
import { useNow } from '../../../../shared/hooks/useNow';

const ROOT_PATH = '';
const EMPTY_ENTRIES: ReadonlyArray<ExploreEntry> = Object.freeze([]);
type Props = {
  readonly sessionId: SessionId;
  readonly sessionDir: string | null;
};

type RenderEntriesParams = {
  readonly entries: ReadonlyArray<ExploreEntry>;
};

const toErrorMessage = ({ error }: { readonly error: unknown }): string => {
  if (error instanceof Error && error.message.trim() !== '') {
    return error.message;
  }
  return 'Unknown error';
};

export const ExplorePane = ({ sessionId, sessionDir }: Props) => {
  const now = useNow(30_000);
  const [entriesByPath, setEntriesByPath] = useState<
    Readonly<Record<string, ReadonlyArray<ExploreEntry>>>
  >({});
  const [expandedByPath, setExpandedByPath] = useState<Readonly<Record<string, boolean>>>({});
  const [loadingByPath, setLoadingByPath] = useState<Readonly<Record<string, boolean>>>({});
  const [errorByPath, setErrorByPath] = useState<Readonly<Record<string, string | null>>>({});
  const [actionErrorByPath, setActionErrorByPath] = useState<
    Readonly<Record<string, ExploreOpenFailure | null>>
  >({});
  const exploreOpen = useExploreOpen({ sessionId, sessionDir });
  const toggleDrawer = useAppStore((s) => s.toggleDrawer);
  const selectedRelPath = useAppStore((s) => {
    const drawer = selectOpenDrawer(s);
    if (drawer === null || drawer.kind !== 'explore-file' || drawer.sessionId !== sessionId) {
      return null;
    }
    return drawer.payload.entry.relPath;
  });

  const loadDirectory = useCallback(
    async ({ relPath }: { readonly relPath: string }) => {
      if (sessionDir == null || sessionDir.trim() === '') {
        return;
      }
      setLoadingByPath((previous) => ({ ...previous, [relPath]: true }));
      setErrorByPath((previous) => ({ ...previous, [relPath]: null }));
      try {
        const entries = await exploreList({ sessionDir, relPath });
        setEntriesByPath((previous) => ({ ...previous, [relPath]: entries }));
      } catch (error) {
        setErrorByPath((previous) => ({
          ...previous,
          [relPath]: toErrorMessage({ error }),
        }));
      }
      setLoadingByPath((previous) => ({ ...previous, [relPath]: false }));
    },
    [sessionDir],
  );

  useEffect(() => {
    setEntriesByPath({});
    setExpandedByPath({});
    setLoadingByPath({});
    setErrorByPath({});
    setActionErrorByPath({});
    if (sessionDir == null || sessionDir.trim() === '') {
      setErrorByPath({ [ROOT_PATH]: 'Session folder is not available yet.' });
      return;
    }
    void loadDirectory({ relPath: ROOT_PATH });
  }, [loadDirectory, sessionDir, sessionId]);

  const runOpenAction = useCallback(
    async ({ entry, isReveal }: { readonly entry: ExploreEntry; readonly isReveal: boolean }) => {
      const failure = await exploreOpen.run({ entry, isReveal });
      setActionErrorByPath((previous) => ({ ...previous, [entry.relPath]: failure }));
    },
    [exploreOpen],
  );

  const selectFile = useCallback(
    ({ entry }: { readonly entry: ExploreEntry }) => {
      if (entry.isDir || sessionDir == null || sessionDir.trim() === '') {
        return;
      }
      toggleDrawer({ kind: 'explore-file', sessionId, payload: { sessionDir, entry } });
    },
    [sessionDir, sessionId, toggleDrawer],
  );

  const toggleDirectory = useCallback(
    async ({ entry }: { readonly entry: ExploreEntry }) => {
      if (entry.isDir !== true) {
        return;
      }
      const isExpanded = expandedByPath[entry.relPath] === true;
      setExpandedByPath((previous) => ({ ...previous, [entry.relPath]: !isExpanded }));
      if (isExpanded) {
        return;
      }
      if (entriesByPath[entry.relPath] != null) {
        return;
      }
      if (loadingByPath[entry.relPath] === true) {
        return;
      }
      await loadDirectory({ relPath: entry.relPath });
    },
    [entriesByPath, expandedByPath, loadDirectory, loadingByPath, now],
  );

  const renderEntries = useCallback(
    ({ entries }: RenderEntriesParams): ReactNode => {
      return entries.map((entry) => {
        const isExpanded = expandedByPath[entry.relPath] === true;
        const children = entriesByPath[entry.relPath] ?? EMPTY_ENTRIES;
        const isLoadingChildren = loadingByPath[entry.relPath] === true;
        const childError = errorByPath[entry.relPath] ?? null;
        const actionError = actionErrorByPath[entry.relPath] ?? null;
        const isSelectedFile = selectedRelPath === entry.relPath;
        const age = entry.modifiedAt == null ? '' : formatAge({ from: entry.modifiedAt, now });
        const ageLabel = age === '' ? 'unknown age' : age;
        const sizeLabel = formatBytes({ bytes: entry.sizeBytes });
        const metaTitle = `${sizeLabel} · ${ageLabel}`;
        const openAction = exploreOpen.actionOf({ entry });

        return (
          <div key={entry.relPath} className="flex flex-col gap-0.5">
            <div
              className={cn(
                'group/explore-row flex items-center gap-2 rounded-md py-1 pl-1 pr-2 transition-colors',
                isSelectedFile ? 'bg-muted text-foreground' : 'hover:bg-hover',
              )}
            >
              {entry.isDir ? (
                <button
                  type="button"
                  onClick={() => void toggleDirectory({ entry })}
                  aria-label={isExpanded ? `Collapse ${entry.name}` : `Expand ${entry.name}`}
                  aria-expanded={isExpanded}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left text-muted-foreground transition-colors hover:text-foreground"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                    {isExpanded ? (
                      <ChevronDown size={ICON_SIZE.control} aria-hidden />
                    ) : (
                      <ChevronRight size={ICON_SIZE.control} aria-hidden />
                    )}
                  </span>
                  <Folder size={ICON_SIZE.control} aria-hidden className="shrink-0" />
                  <span
                    title={metaTitle}
                    className="min-w-0 flex-1 truncate text-row text-foreground"
                  >
                    {entry.name}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => selectFile({ entry })}
                  aria-label={`Preview ${entry.name}`}
                  aria-pressed={isSelectedFile}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left underline-offset-2 hover:underline"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground">
                    <File size={ICON_SIZE.control} aria-hidden />
                  </span>
                  <span
                    title={metaTitle}
                    className="min-w-0 flex-1 truncate text-row text-foreground"
                  >
                    {entry.name}
                  </span>
                </button>
              )}
              <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/explore-row:opacity-100 group-focus-within/explore-row:opacity-100">
                {entry.isDir ? null : <ExploreSpawnPopover sessionId={sessionId} entry={entry} />}
                <IconButton
                  icon={openAction.editor === null ? ExternalLink : CONCEPT_ICONS.editor}
                  size="xs"
                  label={
                    openAction.editor === null
                      ? `Open ${entry.name}`
                      : `Open ${entry.name} in ${openAction.editor.label}`
                  }
                  tooltip={openAction.label}
                  onClick={() => void runOpenAction({ entry, isReveal: false })}
                />
                <IconButton
                  icon={FolderOpen}
                  size="xs"
                  label={`Show ${entry.name} in Finder`}
                  tooltip="Show in Finder"
                  onClick={() => void runOpenAction({ entry, isReveal: true })}
                />
              </div>
            </div>
            {actionError != null ? (
              <ExploreOpenError failure={actionError} className="pl-8" />
            ) : null}
            {entry.isDir && isExpanded ? (
              <div className="flex flex-col gap-0.5 pl-5">
                {isLoadingChildren ? (
                  <>
                    <Skeleton className="h-6 w-full rounded-md" />
                    <Skeleton className="h-6 w-10/12 rounded-md" />
                  </>
                ) : childError != null ? (
                  <EmptyState
                    size="section"
                    icon={CONCEPT_ICONS.errors}
                    tone={CONCEPT_TONE.errors}
                    title="Couldn't read this folder"
                    description={childError}
                  />
                ) : children.length === 0 ? (
                  <EmptyState
                    size="section"
                    icon={CONCEPT_ICONS.explore}
                    tone={CONCEPT_TONE.explore}
                    title="This folder is empty"
                  />
                ) : (
                  <div className="flex flex-col gap-0.5">
                    {renderEntries({ entries: children })}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        );
      });
    },
    [
      actionErrorByPath,
      entriesByPath,
      errorByPath,
      expandedByPath,
      loadingByPath,
      selectedRelPath,
      exploreOpen,
      runOpenAction,
      selectFile,
      sessionId,
      toggleDirectory,
    ],
  );

  const rootEntries = useMemo(() => entriesByPath[ROOT_PATH] ?? EMPTY_ENTRIES, [entriesByPath]);
  const rootLoading = loadingByPath[ROOT_PATH] === true;
  const rootError = errorByPath[ROOT_PATH] ?? null;
  const refreshTree = () => {
    void loadDirectory({ relPath: ROOT_PATH });
    for (const [relPath, isExpanded] of Object.entries(expandedByPath)) {
      if (isExpanded) {
        void loadDirectory({ relPath });
      }
    }
  };

  return (
    <PaneShell
      title="Explore"
      actions={
        <RefreshIconButton
          label="Refresh the files"
          isLoading={rootLoading}
          onClick={refreshTree}
        />
      }
    >
      <div className="flex flex-col gap-3">
        {rootLoading ? (
          <>
            <Skeleton className="h-6 w-full rounded-md" />
            <Skeleton className="h-6 w-11/12 rounded-md" />
            <Skeleton className="h-6 w-10/12 rounded-md" />
          </>
        ) : rootError != null ? (
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
                onClick={() => void loadDirectory({ relPath: ROOT_PATH })}
              >
                Retry
              </Button>
            }
          />
        ) : rootEntries.length === 0 ? (
          <EmptyState
            size="section"
            tone={CONCEPT_TONE.explore}
            icon={CONCEPT_ICONS.explore}
            title="No new files"
          />
        ) : (
          <div className="flex flex-col gap-0.5">{renderEntries({ entries: rootEntries })}</div>
        )}
      </div>
    </PaneShell>
  );
};
