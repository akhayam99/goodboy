import { useMemo, useRef } from 'react';
import { Button, EmptyLine, EmptyState, PaneShell, Notice, SkeletonRow } from '@goodboy/ui';
import type { ArtifactId, SessionId } from '@goodboy/types';
import { WireframeImportNotice } from '../../../wireframes/components/WireframeImportNotice';
import { useWireframeImport } from '../../../wireframes/useWireframeImport';
import { useFileDropTarget } from '../../../../shared/hooks/useFileDropTarget';
import { useAppStore } from '../../../../store';
import { loadStateOf } from '../../../../shared/lib/loadStateOf';
import type { ArtifactFilter } from '../../artifactCollection';
import {
  groupArtifactRows,
  type ArtifactListCounts,
  type ArtifactListRow as Row,
} from '../../artifactListRows';
import { newArtifactEventName } from '../../newArtifactEventName';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { ArtifactFilterTabs } from '../ArtifactStudio/ArtifactFilterTabs';
import { ArtifactListOverflowMenu } from './ArtifactListOverflowMenu';
import { ArtifactListGroup } from './ArtifactListGroup';
import { ArtifactNewMenu } from './ArtifactNewMenu';
import { useArtifactGroups } from './useArtifactGroups';

type Props = {
  readonly sessionId: SessionId;
  readonly rows: ReadonlyArray<Row>;
  readonly counts: ArtifactListCounts;
  readonly filter: ArtifactFilter;
  readonly onFilterChange: (filter: ArtifactFilter) => void;
  readonly onOpen: (row: Row) => void;
  readonly onImported: (artifactId: ArtifactId) => void;
};

const NO_MATCH_LINE: Record<ArtifactFilter, string> = {
  all: 'No artifacts match this filter.',
  plan: 'No plans in this session.',
  report: 'No reports in this session.',
  wireframe: 'No wireframes in this session.',
};

export const ArtifactList = ({
  sessionId,
  rows,
  counts,
  filter,
  onFilterChange,
  onOpen,
  onImported,
}: Props) => {
  const hasLoaded = useAppStore((state) => state.sessionArtifacts[sessionId] !== undefined);
  const error = useAppStore((state) => state.artifactLoadErrors?.[sessionId] ?? null);
  const loadSessionArtifacts = useAppStore((state) => state.loadSessionArtifacts);
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
  const { isDragging } = useFileDropTarget({
    targetRef: dropRef,
    onDropPaths: ({ paths }) => {
      const json = paths.find((path) => path.toLowerCase().endsWith('.json')) ?? null;
      if (json !== null) {
        importer.readPath(json);
      }
    },
  });
  const { closedGroups, openPartsIds, toggleGroup, toggleParts } = useArtifactGroups({ rows });
  const groups = useMemo(() => groupArtifactRows({ rows }), [rows]);
  const openNewMenu = () => window.dispatchEvent(new CustomEvent(newArtifactEventName(sessionId)));

  return (
    <PaneShell
      header={
        <div className="flex min-h-8 min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex min-w-0 items-baseline gap-2">
            <h1 className="min-w-0 truncate text-title text-foreground">Artifacts</h1>
            {counts.all > 0 ? (
              <span className="shrink-0 text-meta tabular-nums text-muted-foreground">
                {counts.all}
              </span>
            ) : null}
          </div>
          <ArtifactFilterTabs value={filter} counts={counts} onChange={onFilterChange} />
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <ArtifactNewMenu sessionId={sessionId} onImportWireframe={importer.pick} />
            <ArtifactListOverflowMenu sessionId={sessionId} />
          </div>
        </div>
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
        {importer.pending === null && importer.error !== null ? (
          <span role="alert" className="text-meta text-danger">
            {importer.error}
          </span>
        ) : null}
        {loadState === 'loading' ? (
          <div aria-busy="true" className="flex flex-col gap-3">
            {[0, 1, 2].map((index) => (
              <SkeletonRow key={index} label="Loading artifacts" />
            ))}
          </div>
        ) : loadState === 'error' ? (
          <Notice
            tone="danger"
            placement="inline"
            role="alert"
            title="Could not load artifacts"
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
            description="Plans, reports and wireframes made in this session are kept here."
            action={
              <Button variant="primary" size="sm" onClick={openNewMenu}>
                New artifact
              </Button>
            }
          />
        ) : rows.length === 0 ? (
          <EmptyLine
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
          <div data-testid="artifact-list" className="flex min-w-0 flex-col gap-3">
            {groups.map((entry) => (
              <ArtifactListGroup
                key={entry.group}
                group={entry.group}
                rows={entry.rows}
                sessionId={sessionId}
                isOpen={!closedGroups.has(entry.group)}
                openPartsIds={openPartsIds}
                onToggleGroup={toggleGroup}
                onTogglePartsOf={toggleParts}
                onOpenRow={onOpen}
              />
            ))}
          </div>
        )}
      </div>
    </PaneShell>
  );
};
