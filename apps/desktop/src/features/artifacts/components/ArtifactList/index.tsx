import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, EmptyLine, EmptyState, ListGrid, PaneShell, Notice } from '@goodboy/ui';
import type { ArtifactId, SessionId } from '@goodboy/types';
import { WireframeImportNotice } from '../../../wireframes/components/WireframeImportNotice';
import { useWireframeImport } from '../../../wireframes/useWireframeImport';
import { useFileDropTarget } from '../../../../shared/hooks/useFileDropTarget';
import { useGroupArrival } from '../../../../shared/hooks/useGroupArrival';
import { useAppStore } from '../../../../store';
import { NOTHING_CHANGED } from '../../../../store/slices/notifications/errorRecovery';
import { loadStateOf } from '../../../../shared/lib/loadStateOf';
import type { ArtifactFilter } from '../../artifactCollection';
import {
  groupArtifactRows,
  type ArtifactListCounts,
  type ArtifactListRow as Row,
} from '../../artifactListRows';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { GroupBySwitch } from '../../../../shared/components/GroupBySwitch';
import { ArtifactFilterTabs } from '../ArtifactStudio/ArtifactFilterTabs';
import { ArtifactBranchList } from './ArtifactBranchList';
import type { ArtifactBranchProps, ArtifactOpenParams } from './artifactBranchProps';
import { ArtifactListSkeleton } from './ArtifactListSkeleton';
import { ArtifactStateGroup } from './ArtifactStateGroup';
import { ARTIFACTS_GRID_COLUMNS } from './artifactsGridColumns';
import { ArtifactNewMenu } from './ArtifactNewMenu';
import { useArtifactParts } from './useArtifactParts';

type Props = {
  readonly sessionId: SessionId;
  readonly returnRowId?: string | null;
  readonly rows: ReadonlyArray<Row>;
  readonly counts: ArtifactListCounts;
  readonly filter: ArtifactFilter;
  readonly onFilterChange: (filter: ArtifactFilter) => void;
  readonly onOpen: (params: ArtifactOpenParams) => void;
  readonly branch?: ArtifactBranchProps;
  readonly onImported: (artifactId: ArtifactId) => void;
};

const IMPORT_FAILED = "Couldn't read the wireframe file";

const keepGrouping = (): void => undefined;

const NO_MATCH_LINE: Record<ArtifactFilter, string> = {
  all: 'No artifacts match this filter.',
  plan: 'No plans in this session.',
  report: 'No reports in this session.',
  wireframe: 'No wireframes in this session.',
};

export const ArtifactList = ({
  sessionId,
  returnRowId = null,
  rows,
  counts,
  filter,
  onFilterChange,
  onOpen,
  branch,
  onImported,
}: Props) => {
  const hasLoaded = useAppStore((state) => state.sessionArtifacts[sessionId] !== undefined);
  const error = useAppStore((state) => state.artifactLoadErrors?.[sessionId] ?? null);
  const loadSessionArtifacts = useAppStore((state) => state.loadSessionArtifacts);
  const reportError = useAppStore((state) => state.reportError);
  const loadState = loadStateOf({ hasLoaded, isLoading: !hasLoaded, error, count: counts.all });
  const dropRef = useRef<HTMLDivElement>(null);
  const importWireframe = useAppStore((state) => state.importWireframe);
  const importer = useWireframeImport({
    commit: async (ready) => {
      const artifact = await importWireframe({
        sessionId,
        title: ready.title,
        sourceText: ready.sourceText,
        fidelity: ready.fidelity,
      });
      onImported(artifact.id);
    },
  });
  const { error: importError, pending: importPending, cancel: cancelImport } = importer;
  useEffect(() => {
    if (importPending !== null || importError === null) {
      return;
    }
    void reportError({
      title: IMPORT_FAILED,
      error: importError,
      recovery: NOTHING_CHANGED,
      sessionId,
    });
    cancelImport();
  }, [importPending, importError, cancelImport, reportError, sessionId]);
  const { isDragging } = useFileDropTarget({
    targetRef: dropRef,
    onDropPaths: ({ paths }) => {
      const json = paths.find((path) => path.toLowerCase().endsWith('.json')) ?? null;
      if (json !== null) {
        importer.readPath(json);
      }
    },
  });
  const { openPartsIds, toggleParts } = useArtifactParts();
  const groups = useMemo(() => groupArtifactRows({ rows }), [rows]);
  const [openedGroupBy] = useState(branch?.groupBy);
  const arrivalGroups = useMemo(
    () =>
      (branch?.view.groups ?? []).map((group) => ({
        key: group.key,
        firstRowKey: group.items.find((item) => item.row.group !== 'deleted')?.row.id ?? null,
      })),
    [branch?.view.groups],
  );
  useGroupArrival({
    isActive:
      openedGroupBy !== undefined &&
      openedGroupBy !== 'branch' &&
      branch?.isSettled === true &&
      loadState !== 'loading' &&
      loadState !== 'error' &&
      rows.length > 0,
    rowAttribute: 'data-row-key',
    groups: arrivalGroups,
    onArrive: keepGrouping,
  });
  const isEmptyShown = loadState === 'empty';

  return (
    <PaneShell
      page="artifacts"
      actions={
        isEmptyShown ? undefined : (
          <ArtifactNewMenu
            sessionId={sessionId}
            isEmpty={counts.all === 0}
            onImportWireframe={importer.pick}
          />
        )
      }
      toolbar={
        counts.all === 0 ? null : (
          <>
            <ArtifactFilterTabs value={filter} counts={counts} onChange={onFilterChange} />
            {branch === undefined || branch.branchCount < 2 ? null : (
              <GroupBySwitch
                value={branch.groupBy}
                onChange={(next) => branch.onGroupByChange({ groupBy: next })}
              />
            )}
          </>
        )
      }
    >
      <div
        ref={dropRef}
        data-drop-composer
        data-testid="artifact-lens-drop"
        data-dragging={isDragging}
        className="flex min-w-0 flex-col gap-3"
      >
        {importer.pending === null ? null : (
          <WireframeImportNotice
            pending={importer.pending}
            isBusy={importer.isBusy}
            error={importer.error}
            onConfirm={importer.confirm}
            onCancel={importer.cancel}
          />
        )}
        {loadState === 'loading' ? (
          <ArtifactListSkeleton />
        ) : loadState === 'error' ? (
          <Notice
            tone="danger"
            placement="inline"
            role="alert"
            title="Couldn't load artifacts"
            detail={error}
            actions={
              <Button size="sm" onClick={() => void loadSessionArtifacts(sessionId)}>
                Retry
              </Button>
            }
          />
        ) : rows.length === 0 && counts.all === 0 ? (
          <EmptyState
            size="page"
            icon={CONCEPT_ICONS.artifacts}
            title="No artifacts yet"
            description="Plans, reports and wireframes this session wrote."
            action={
              <ArtifactNewMenu sessionId={sessionId} isEmpty onImportWireframe={importer.pick} />
            }
          />
        ) : rows.length === 0 ? (
          <EmptyLine
            className="[&>p]:flex-none"
            action={
              filter === 'all' ? undefined : (
                <Button variant="ghost" size="xs" onClick={() => onFilterChange('all')}>
                  Clear filter
                </Button>
              )
            }
          >
            {NO_MATCH_LINE[filter]}
          </EmptyLine>
        ) : (
          <div data-testid="artifact-list" className="min-w-0">
            <ListGrid label="Artifacts" columns={ARTIFACTS_GRID_COLUMNS} isGrouped>
              {branch !== undefined && branch.groupBy === 'branch' ? (
                <ArtifactBranchList
                  view={branch.view}
                  returnRowId={returnRowId}
                  mounts={branch.mounts}
                  sessionId={sessionId}
                  openPartsIds={openPartsIds}
                  onTogglePartsOf={toggleParts}
                  onOpenRow={onOpen}
                  onOpenBranch={branch.onOpenBranch}
                  canOpenBranch={branch.canOpenBranch}
                />
              ) : (
                groups.map((entry) => (
                  <ArtifactStateGroup
                    key={entry.group}
                    group={entry.group}
                    rows={entry.rows}
                    sessionId={sessionId}
                    openPartsIds={openPartsIds}
                    onTogglePartsOf={toggleParts}
                    onOpenRow={onOpen}
                  />
                ))
              )}
            </ListGrid>
          </div>
        )}
      </div>
    </PaneShell>
  );
};
