import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, File, Folder, FolderSearch } from 'lucide-react';
import { Button, cn, EmptyState, Skeleton, Tooltip } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import {
  exploreList,
  exploreOpen,
  exploreRead,
  type ExploreContent,
  type ExploreEntry,
} from '../../explore';
import { formatRelativeAge } from '../../../../shared/utils/relativeDate';
import { CONCEPT_ICONS, CONCEPT_TONE, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { LensEmptyState } from '@goodboy/ui';
import { PaneShell } from '../../../../shared/components/PaneShell';
import { InspectorSplit } from '../../../session/components/SessionWorkspace/parts/InspectorSplit';
import { ExplorePreviewPanel } from './ExplorePreviewPanel';
import { ExploreSpawnPopover } from './ExploreSpawnPopover';

const ROOT_PATH = '';
const EMPTY_ENTRIES: ReadonlyArray<ExploreEntry> = Object.freeze([]);
const KNOWN_UNSUPPORTED_PREVIEW_EXTENSIONS = new Set([
  'doc',
  'docx',
  'key',
  'numbers',
  'ods',
  'odt',
  'pages',
  'ppt',
  'pptx',
  'xls',
  'xlsx',
]);

type Props = {
  readonly sessionId: SessionId;
  readonly sessionDir: string | null;
  readonly eyebrow?: ReactNode;
};

type RenderEntriesParams = {
  readonly entries: ReadonlyArray<ExploreEntry>;
};

type PreviewState =
  | {
      readonly status: 'loading';
    }
  | {
      readonly status: 'unsupported';
    }
  | {
      readonly status: 'error';
      readonly message: string;
    }
  | {
      readonly status: 'ready';
      readonly content: ExploreContent;
    };

const formatByteSize = ({ bytes }: { readonly bytes: number }): string => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = bytes / 1024;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  const precision = size >= 10 ? 0 : 1;
  return `${size.toFixed(precision)} ${units[index]}`;
};

const resolveAbsolutePath = ({
  sessionDir,
  relPath,
}: {
  readonly sessionDir: string;
  readonly relPath: string;
}): string => {
  if (relPath === '') {
    return sessionDir;
  }
  if (sessionDir.endsWith('/') || sessionDir.endsWith('\\')) {
    return `${sessionDir}${relPath}`;
  }
  return `${sessionDir}/${relPath}`;
};

const toErrorMessage = ({ error }: { readonly error: unknown }): string => {
  if (error instanceof Error && error.message.trim() !== '') {
    return error.message;
  }
  return 'Unknown error';
};

const extensionOf = ({ fileName }: { readonly fileName: string }): string => {
  const dot = fileName.lastIndexOf('.');
  if (dot < 0) {
    return '';
  }
  return fileName.slice(dot + 1).toLowerCase();
};

const isKnownUnsupportedPreviewExtension = ({
  fileName,
}: {
  readonly fileName: string;
}): boolean => {
  return KNOWN_UNSUPPORTED_PREVIEW_EXTENSIONS.has(extensionOf({ fileName }));
};

export const ExplorePane = ({ sessionId, sessionDir, eyebrow }: Props) => {
  const [entriesByPath, setEntriesByPath] = useState<
    Readonly<Record<string, ReadonlyArray<ExploreEntry>>>
  >({});
  const [expandedByPath, setExpandedByPath] = useState<Readonly<Record<string, boolean>>>({});
  const [loadingByPath, setLoadingByPath] = useState<Readonly<Record<string, boolean>>>({});
  const [errorByPath, setErrorByPath] = useState<Readonly<Record<string, string | null>>>({});
  const [actionErrorByPath, setActionErrorByPath] = useState<
    Readonly<Record<string, string | null>>
  >({});
  const [previewByPath, setPreviewByPath] = useState<Readonly<Record<string, PreviewState>>>({});
  const [selectedFile, setSelectedFile] = useState<ExploreEntry | null>(null);

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

  const loadPreview = useCallback(
    async ({ entry }: { readonly entry: ExploreEntry }) => {
      if (sessionDir == null || sessionDir.trim() === '') {
        return;
      }
      if (isKnownUnsupportedPreviewExtension({ fileName: entry.name })) {
        setPreviewByPath((previous) => ({
          ...previous,
          [entry.relPath]: { status: 'unsupported' },
        }));
        return;
      }
      setPreviewByPath((previous) => ({ ...previous, [entry.relPath]: { status: 'loading' } }));
      try {
        const content = await exploreRead({ sessionDir, relPath: entry.relPath });
        setPreviewByPath((previous) => ({
          ...previous,
          [entry.relPath]: { status: 'ready', content },
        }));
      } catch (error) {
        setPreviewByPath((previous) => ({
          ...previous,
          [entry.relPath]: {
            status: 'error',
            message: toErrorMessage({ error }),
          },
        }));
      }
    },
    [sessionDir],
  );

  useEffect(() => {
    setEntriesByPath({});
    setExpandedByPath({});
    setLoadingByPath({});
    setErrorByPath({});
    setActionErrorByPath({});
    setPreviewByPath({});
    setSelectedFile(null);
    if (sessionDir == null || sessionDir.trim() === '') {
      setErrorByPath({ [ROOT_PATH]: 'Session folder is not available yet.' });
      return;
    }
    void loadDirectory({ relPath: ROOT_PATH });
  }, [loadDirectory, sessionDir, sessionId]);

  const runOpenAction = useCallback(
    async ({ entry, reveal }: { readonly entry: ExploreEntry; readonly reveal: boolean }) => {
      if (sessionDir == null || sessionDir.trim() === '') {
        return;
      }
      try {
        await exploreOpen({ sessionDir, relPath: entry.relPath, reveal });
        setActionErrorByPath((previous) => ({ ...previous, [entry.relPath]: null }));
      } catch (error) {
        const verb = reveal ? 'reveal' : 'open';
        setActionErrorByPath((previous) => ({
          ...previous,
          [entry.relPath]: `Could not ${verb} "${entry.name}". ${toErrorMessage({ error })}`,
        }));
      }
    },
    [sessionDir],
  );

  const selectFile = useCallback(
    ({ entry }: { readonly entry: ExploreEntry }) => {
      if (entry.isDir) {
        return;
      }
      setSelectedFile(entry);
      const cached = previewByPath[entry.relPath];
      if (cached != null && cached.status !== 'error') {
        return;
      }
      void loadPreview({ entry });
    },
    [loadPreview, previewByPath],
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
    [entriesByPath, expandedByPath, loadDirectory, loadingByPath],
  );

  const renderEntries = useCallback(
    ({ entries }: RenderEntriesParams): ReactNode => {
      return entries.map((entry) => {
        const isExpanded = expandedByPath[entry.relPath] === true;
        const children = entriesByPath[entry.relPath] ?? EMPTY_ENTRIES;
        const isLoadingChildren = loadingByPath[entry.relPath] === true;
        const childError = errorByPath[entry.relPath] ?? null;
        const actionError = actionErrorByPath[entry.relPath] ?? null;
        const isSelectedFile = selectedFile?.relPath === entry.relPath;
        const age =
          entry.modifiedAt == null ? '' : formatRelativeAge({ fromIso: entry.modifiedAt });
        const ageLabel = age === '' ? 'unknown age' : age;
        const sizeLabel = formatByteSize({ bytes: entry.sizeBytes });

        return (
          <div key={entry.relPath} className="flex flex-col gap-0.5">
            <div
              title={`${sizeLabel} · ${ageLabel}`}
              className={cn(
                'group/explore-row flex items-center gap-1.5 rounded-md py-1 pl-1 pr-2 transition-colors',
                isSelectedFile ? 'bg-muted text-foreground' : 'hover:bg-muted/40',
              )}
            >
              {entry.isDir ? (
                <button
                  type="button"
                  onClick={() => void toggleDirectory({ entry })}
                  aria-label={isExpanded ? `Collapse ${entry.name}` : `Expand ${entry.name}`}
                  aria-expanded={isExpanded}
                  className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md text-left text-muted-foreground transition-colors hover:text-foreground"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                    {isExpanded ? (
                      <ChevronDown size={ICON_SIZE.control} aria-hidden />
                    ) : (
                      <ChevronRight size={ICON_SIZE.control} aria-hidden />
                    )}
                  </span>
                  <Folder size={ICON_SIZE.control} aria-hidden className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                    {entry.name}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => selectFile({ entry })}
                  aria-label={`Preview ${entry.name}`}
                  className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md text-left underline-offset-2 hover:underline"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground">
                    <File size={ICON_SIZE.control} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                    {entry.name}
                  </span>
                </button>
              )}
              <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/explore-row:opacity-100 group-focus-within/explore-row:opacity-100">
                {entry.isDir ? null : <ExploreSpawnPopover sessionId={sessionId} entry={entry} />}
                <Tooltip content={`Open ${entry.name} outside the app`}>
                  <button
                    type="button"
                    onClick={() => void runOpenAction({ entry, reveal: false })}
                    aria-label={`Open ${entry.name} outside the app`}
                    className="rounded-md p-1.5 text-muted-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground"
                  >
                    <ExternalLink size={ICON_SIZE.control} aria-hidden />
                  </button>
                </Tooltip>
                <Tooltip content={`Reveal ${entry.name} in file manager`}>
                  <button
                    type="button"
                    onClick={() => void runOpenAction({ entry, reveal: true })}
                    aria-label={`Reveal ${entry.name} in file manager`}
                    className="rounded-md p-1.5 text-muted-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground"
                  >
                    <FolderSearch size={ICON_SIZE.control} aria-hidden />
                  </button>
                </Tooltip>
              </div>
            </div>
            {actionError != null ? <p className="pl-8 text-xs text-danger">{actionError}</p> : null}
            {entry.isDir && isExpanded ? (
              <div className="flex flex-col gap-0.5 pl-5">
                {isLoadingChildren ? (
                  <>
                    <Skeleton className="h-6 w-full rounded-md" />
                    <Skeleton className="h-6 w-10/12 rounded-md" />
                  </>
                ) : childError != null ? (
                  <EmptyState
                    icon={CONCEPT_ICONS.errors}
                    tone={CONCEPT_TONE.errors}
                    title="Could not read this folder"
                    description={childError}
                    size="inline"
                  />
                ) : children.length === 0 ? (
                  <EmptyState
                    icon={CONCEPT_ICONS.explore}
                    tone={CONCEPT_TONE.explore}
                    title="This folder is empty"
                    size="inline"
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
      selectedFile,
      runOpenAction,
      selectFile,
      sessionId,
      toggleDirectory,
    ],
  );

  const rootEntries = useMemo(() => entriesByPath[ROOT_PATH] ?? EMPTY_ENTRIES, [entriesByPath]);
  const rootLoading = loadingByPath[ROOT_PATH] === true;
  const rootError = errorByPath[ROOT_PATH] ?? null;
  const selectedPreview = useMemo<PreviewState | null>(() => {
    if (selectedFile == null) {
      return null;
    }
    return previewByPath[selectedFile.relPath] ?? { status: 'loading' };
  }, [previewByPath, selectedFile]);
  const selectedAbsolutePath = useMemo(() => {
    if (selectedFile == null) {
      return '';
    }
    if (sessionDir == null || sessionDir.trim() === '') {
      return selectedFile.relPath;
    }
    return resolveAbsolutePath({ sessionDir, relPath: selectedFile.relPath });
  }, [selectedFile, sessionDir]);

  return (
    <InspectorSplit
      open={selectedFile != null}
      panel={
        selectedFile != null && selectedPreview != null ? (
          <ExplorePreviewPanel
            entry={selectedFile}
            previewState={selectedPreview}
            absolutePath={selectedAbsolutePath}
            onClose={() => setSelectedFile(null)}
            onOpenOutside={() => void runOpenAction({ entry: selectedFile, reveal: false })}
          />
        ) : null
      }
    >
      <PaneShell title="Explore" description="Browse the files for this session." eyebrow={eyebrow}>
        <div className="flex flex-col gap-3">
          {rootLoading ? (
            <>
              <Skeleton className="h-6 w-full rounded-md" />
              <Skeleton className="h-6 w-11/12 rounded-md" />
              <Skeleton className="h-6 w-10/12 rounded-md" />
            </>
          ) : rootError != null ? (
            <LensEmptyState
              tone={CONCEPT_TONE.explore}
              icon={CONCEPT_ICONS.explore}
              title="Could not read this session folder"
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
            <LensEmptyState
              tone={CONCEPT_TONE.explore}
              icon={CONCEPT_ICONS.explore}
              title="This session folder is empty"
              description="Files created while you work on this session appear here. Add one from your editor or terminal and refresh."
            />
          ) : (
            <div className="flex flex-col gap-0.5">{renderEntries({ entries: rootEntries })}</div>
          )}
        </div>
      </PaneShell>
    </InspectorSplit>
  );
};
