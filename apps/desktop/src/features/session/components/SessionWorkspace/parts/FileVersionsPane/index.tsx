import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import { Divider, formatError } from '@goodboy/ui';
import { useShallow } from 'zustand/react/shallow';
import type { FileVersion, FileVersionId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../../store';
import {
  CONCEPT_ICONS,
  CONCEPT_TONE,
  ICON_SIZE,
} from '../../../../../../shared/components/conceptIcons';
import { LensEmptyState } from '@goodboy/ui';
import { PaneShell } from '../../../../../../shared/components/PaneShell';
import { fileVersionGroups } from './fileVersionGroups';
import { PathSummaryList } from './pathSummaryList';
import { VersionHistoryList } from './versionHistoryList';

type Props = {
  sessionId: SessionId;
  sessionDir: string;
  onClose: () => void;
  eyebrow?: ReactNode;
};

const EMPTY_VERSIONS: ReadonlyArray<FileVersion> = [];

export const FileVersionsPane = ({ sessionId, sessionDir, onClose, eyebrow }: Props) => {
  const versions = useAppStore(
    useShallow((state) => state.sessionFileVersions[sessionId] ?? EMPTY_VERSIONS),
  );
  const loading = useAppStore((state) => state.sessionFileVersionsLoading[sessionId] === true);
  const selectedPath = useAppStore(
    (state) => state.sessionFileVersionSelectedPath[sessionId] ?? null,
  );
  const loadSessionFileVersions = useAppStore((state) => state.loadSessionFileVersions);
  const selectSessionFileVersionPath = useAppStore((state) => state.selectSessionFileVersionPath);
  const restoreSessionFileVersion = useAppStore((state) => state.restoreSessionFileVersion);
  const deleteSessionFileVersion = useAppStore((state) => state.deleteSessionFileVersion);
  const deleteAllSessionFileVersions = useAppStore((state) => state.deleteAllSessionFileVersions);
  const [restoringVersionId, setRestoringVersionId] = useState<FileVersionId | null>(null);
  const [deletingVersionId, setDeletingVersionId] = useState<FileVersionId | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const [deleteAllArmed, setDeleteAllArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadSessionFileVersions({ sessionId });
  }, [loadSessionFileVersions, sessionId]);

  const groups = useMemo(() => fileVersionGroups({ versions }), [versions]);
  const selectedGroup = useMemo(
    () => groups.find((group) => group.relativePath === selectedPath) ?? groups[0] ?? null,
    [groups, selectedPath],
  );

  const onRestoreVersion = async (versionId: FileVersionId) => {
    setError(null);
    setRestoringVersionId(versionId);
    try {
      await restoreSessionFileVersion({ sessionId, versionId, sessionDir });
    } catch (restoreError) {
      setError(formatError(restoreError));
    } finally {
      setRestoringVersionId(null);
    }
  };

  const onDeleteVersion = async (versionId: FileVersionId) => {
    setError(null);
    setDeletingVersionId(versionId);
    try {
      await deleteSessionFileVersion({ sessionId, versionId });
    } catch (deleteError) {
      setError(formatError(deleteError));
    } finally {
      setDeletingVersionId(null);
    }
  };

  const onDeleteAll = async () => {
    setError(null);
    setDeletingAll(true);
    try {
      await deleteAllSessionFileVersions({ sessionId });
      setDeleteAllArmed(false);
    } catch (deleteError) {
      setError(formatError(deleteError));
    } finally {
      setDeletingAll(false);
    }
  };

  return (
    <PaneShell
      title="File versions"
      description="Before an agent changes a file in this session, Goodboy stores the previous copy here so you can bring it back."
      measure={loading || groups.length > 0 ? 'full' : 'pane'}
      eyebrow={eyebrow}
      actions={
        <>
          {deleteAllArmed ? (
            <>
              <button
                type="button"
                onClick={() => void onDeleteAll()}
                disabled={deletingAll}
                className="inline-flex items-center gap-1 rounded-md border border-danger/40 px-2 py-1 text-xs font-medium text-danger transition-colors hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 size={ICON_SIZE.row} aria-hidden />
                {deletingAll ? 'Deleting' : 'Confirm delete all'}
              </button>
              <button
                type="button"
                onClick={() => setDeleteAllArmed(false)}
                disabled={deletingAll}
                className="inline-flex items-center rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setDeleteAllArmed(true)}
              disabled={versions.length === 0 || loading}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 size={ICON_SIZE.row} aria-hidden />
              Delete all
            </button>
          )}
        </>
      }
    >
      {loading || groups.length > 0 ? (
        <div className="flex items-stretch gap-3">
          <div className="flex w-80 shrink-0 flex-col gap-2">
            <h2 className="text-sm font-semibold text-foreground">Files</h2>
            <PathSummaryList
              groups={groups}
              selectedPath={selectedGroup?.relativePath ?? null}
              loading={loading}
              onSelectPath={(relativePath) =>
                selectSessionFileVersionPath({ sessionId, relativePath })
              }
            />
          </div>
          <Divider orientation="vertical" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <h2 className="text-sm font-semibold text-foreground">
              {selectedGroup?.relativePath ?? 'History'}
            </h2>
            <VersionHistoryList
              versions={selectedGroup?.versions ?? []}
              restoringVersionId={restoringVersionId}
              deletingVersionId={deletingVersionId}
              onRestoreVersion={onRestoreVersion}
              onDeleteVersion={onDeleteVersion}
            />
          </div>
        </div>
      ) : (
        <LensEmptyState
          tone={CONCEPT_TONE.diff}
          icon={CONCEPT_ICONS.diff}
          title="No versions yet"
          description="When an agent edits a file, Goodboy stores the file as it was before the edit. The first change will appear here."
          action={
            <button
              type="button"
              onClick={onClose}
              className="inline-flex rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              Close
            </button>
          }
        />
      )}
      {error != null ? <p className="text-sm font-medium text-danger">{error}</p> : null}
    </PaneShell>
  );
};
