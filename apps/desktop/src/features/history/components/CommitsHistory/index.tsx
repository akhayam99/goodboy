import { useRef, useState } from 'react';
import { Button, Notice, EmptyState, PageColumn, ScrollFade, SkeletonRow, cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { useElementWidth } from '../../../../shared/hooks/useElementWidth';
import { loadStateOf } from '../../../../shared/lib/loadStateOf';
import { keptOrder } from '../../historyPlan';
import { HistoryAfterColumn } from './HistoryAfterColumn';
import { HistoryAppliedResult } from './HistoryAppliedResult';
import { HistoryDragGhost } from './HistoryDragGhost';
import { HistoryKeysHint } from './HistoryKeysHint';
import { HistoryNowColumn } from './HistoryNowColumn';
import { HistoryPlannedSection } from './HistoryPlannedSection';
import { HistoryResultHead } from './HistoryResultHead';
import { HistoryStatusSlot } from './HistoryStatusSlot';
import { HistoryVersionsLink } from './HistoryVersionsLink';
import { buildHistoryRowRenderer } from './buildHistoryRowRenderer';
import { historyLaneNodes } from './historyLaneNodes';
import { useHistoryVersionsDrawer } from './useHistoryVersionsDrawer';
import { useHistoryEditing } from './useHistoryEditing';
import { useHistoryExpanded } from './useHistoryExpanded';
import { useHistoryFocus } from './useHistoryFocus';
import { useHistoryKeys } from './useHistoryKeys';
import { useHistoryPanelReveal } from './useHistoryPanelReveal';
import { useHistoryPlan } from './useHistoryPlan';
import { useHistoryPlanDrag } from './useHistoryPlanDrag';
import { useHistoryPrediction } from './useHistoryPrediction';
import { useHistoryRowCallbacks } from './useHistoryRowCallbacks';
import { useHistoryRows } from './useHistoryRows';
import { useHistoryRunFlow } from './useHistoryRunFlow';
import { useHistoryScribe } from './useHistoryScribe';
import { useHistoryBackupCount } from '../../useHistoryBackupCount';

type Props = {
  readonly sessionId: SessionId;
  readonly worktreePath: string;
  readonly isReadOnly?: boolean;
};

const NARROW_WIDTH = 760;

export const CommitsHistory = ({ sessionId, worktreePath, isReadOnly = false }: Props) => {
  const plan = useHistoryPlan({ sessionId, worktreePath });
  const {
    mount,
    mountId,
    draft,
    run,
    prNumber,
    items,
    commits,
    onto,
    graph,
    commitBySha,
    titleOf,
    marks,
    edits,
    model,
    chosenBase,
    status,
    hasUpstream,
    dirtyCount,
    applied,
    isDone,
    isInteractive: isEditable,
  } = plan;
  const isInteractive = isEditable && !isReadOnly;
  const flow = useHistoryRunFlow({ sessionId, mountId, hasUpstream });
  const versionsDrawer = useHistoryVersionsDrawer({ sessionId, mountId, worktreePath });
  const backupCount = useHistoryBackupCount({
    worktreePath,
    branch: mount?.branch ?? '',
    revision: run?.updatedAt ?? 0,
  });
  const [editingSha, setEditingSha] = useState<string | null>(null);
  const [narrowView, setNarrowView] = useState<'now' | 'planned'>('now');
  const [nowMs] = useState(() => Date.now());
  const { expanded, toggleExpanded } = useHistoryExpanded();
  const listRef = useRef<HTMLDivElement | null>(null);
  const stage = useElementWidth();
  const { setHover, highlightedRows, highlightedEdits } = useHistoryFocus({
    edits,
    marks,
    run,
    isDone,
  });
  const { conflictStep, conflict, isPredictionSupported } = useHistoryPrediction({
    draft,
    edits,
    onto,
  });
  const editing = useHistoryEditing({
    sessionId,
    mountId,
    items,
    onto,
    original: plan.original,
    titleOf,
    clearHover: () => setHover(null),
  });
  const isNarrow = stage.width !== null && stage.width < NARROW_WIDTH;
  const hasPlan = edits.length > 0 && !isDone;
  const reveal = useHistoryPanelReveal({ isOpen: hasPlan && !isNarrow });
  const view = isDone ? 'done' : isNarrow && narrowView === 'planned' ? 'planned' : 'now';
  const workingSha =
    run?.phase === 'trying' && run.progress?.stage === 'step' ? run.progress.sha : null;
  const { rows, positions } = useHistoryRows({
    view,
    commits,
    items,
    commitBySha,
    listRef,
    editingSha,
    expanded,
    stageWidth: stage.width,
    editCount: edits.length,
  });
  const drag = useHistoryPlanDrag({
    listRef,
    isEnabled: isInteractive && editingSha === null,
    items,
    titleOf,
    change: editing.change,
    clearHover: () => setHover(null),
    setLive: editing.setLive,
  });
  const keys = useHistoryKeys({
    sessionId,
    mountId,
    items,
    rows,
    listRef,
    isInteractive,
    titleOf,
    change: editing.change,
    foldDown: editing.foldDown,
    toggleRemove: editing.toggleRemove,
    setEditingSha,
    setLive: editing.setLive,
  });
  const scribe = useHistoryScribe({ sessionId, mountId, editingSha });
  const callbacksFor = useHistoryRowCallbacks({
    latest: { items, titleOf, drag, editing, setEditingSha, setHover, toggleExpanded },
  });

  if (mountId === null || mount === null || flow === null) {
    return (
      <PageColumn>
        <EmptyState
          size="section"
          tone={CONCEPT_TONE.history}
          icon={CONCEPT_ICONS.history}
          title="This branch is not in the session"
          description="Pick a branch from the trail to see its commits."
        />
      </PageColumn>
    );
  }

  const baseBranch = chosenBase ?? graph?.baseRef.replace(/^origin[/]/, '') ?? 'its base branch';
  const nodes = historyLaneNodes({
    rows,
    marks,
    applied,
    positions,
    highlightedRows,
    workingSha,
    isDone,
  });
  const headSha =
    view === 'planned' ? ([...keptOrder({ items })].reverse()[0] ?? model.headSha) : model.headSha;
  const renderRow = buildHistoryRowRenderer({
    sessionId,
    view,
    items,
    marks,
    commitBySha,
    titleOf,
    isDone,
    isInteractive,
    applied,
    conflictStep,
    headSha,
    model,
    prNumber,
    hasUpstream,
    highlightedRows,
    drag,
    editingSha,
    expanded,
    nowMs,
    listRef,
    editing,
    scribe,
    setEditingSha,
    callbacksFor,
  });
  const loadState = loadStateOf({
    hasLoaded: draft !== null,
    isLoading: draft === null,
    error: draft?.loadError,
    count: commits.length,
  });
  const body =
    loadState === 'loading' ? (
      <div aria-busy="true" className="flex flex-col gap-2">
        {[0, 1, 2].map((index) => (
          <SkeletonRow key={index} label="Loading commits" />
        ))}
      </div>
    ) : loadState === 'error' ? (
      <Notice
        tone="danger"
        placement="inline"
        role="alert"
        title="Could not load commits"
        detail={draft?.loadError}
        actions={
          <Button size="sm" onClick={flow.refresh}>
            Retry
          </Button>
        }
      />
    ) : commits.length === 0 ? (
      <EmptyState
        size="section"
        tone={CONCEPT_TONE.history}
        icon={CONCEPT_ICONS.history}
        title="No commits yet on this branch"
        description="This branch has no commits of its own yet."
      />
    ) : (
      <div className="flex flex-col gap-6" onKeyDown={keys.onPageKey}>
        {applied !== null && run !== null ? <HistoryResultHead applied={applied} /> : null}
        <div className="flex flex-col gap-4">
          <div
            ref={stage.ref}
            className={cn(
              'grid items-start motion-safe:transition-[grid-template-columns,column-gap] motion-safe:duration-200',
              !reveal.isMounted && 'grid-cols-1',
              reveal.isMounted && !reveal.isExpanded && 'grid-cols-[minmax(0,1fr)_0px] gap-x-0',
              reveal.isMounted && reveal.isExpanded && 'grid-cols-[minmax(0,1fr)_320px] gap-x-3',
            )}
          >
            <HistoryNowColumn
              sessionId={sessionId}
              repoPath={mount.repoRoot}
              ownBranch={mount.branch}
              onRebase={flow.rebaseOnto}
              view={view}
              isDone={isDone}
              isNarrow={isNarrow}
              hasPlan={hasPlan}
              narrowView={narrowView}
              rows={rows}
              listRef={listRef}
              positions={positions}
              nodes={nodes}
              graph={graph}
              baseSha={draft?.baseSha ?? ''}
              baseBranch={baseBranch}
              isInteractive={isInteractive}
              dropTarget={drag.drag?.target ?? null}
              nowMs={nowMs}
              renderRow={renderRow}
              onKeyDown={keys.onRowKey}
              onNarrowViewChange={setNarrowView}
            />
            {reveal.isMounted ? (
              <HistoryAfterColumn
                beforeCount={model.ownCount}
                afterCount={model.afterCount}
                keep={[...keptOrder({ items })]}
                marks={marks}
                positions={positions}
                isOnMain={onto !== null}
                highlighted={highlightedRows}
                workingSha={workingSha}
                titleOf={titleOf}
                onHover={(sha) => setHover(sha === null ? null : { kind: 'row', sha })}
              />
            ) : null}
          </div>
        </div>
        {backupCount > 0 ? (
          <HistoryVersionsLink count={backupCount} onOpen={versionsDrawer.showVersions} />
        ) : null}
        {isInteractive && !isDone ? <HistoryKeysHint /> : null}
        {applied !== null && run !== null ? (
          <HistoryAppliedResult
            applied={applied}
            run={run}
            flow={flow}
            branch={mount.branch}
            nowMs={nowMs}
            hasUpstream={hasUpstream}
            prNumber={prNumber}
          />
        ) : (
          <HistoryPlannedSection
            edits={edits}
            titleOf={titleOf}
            model={model}
            highlightedKeys={highlightedEdits}
            conflict={conflict}
            isPredictionSupported={isPredictionSupported}
            hasUpstream={hasUpstream}
            prNumber={prNumber}
            dirtyCount={dirtyCount}
            isInteractive={isInteractive}
            status={
              run === null ? null : (
                <HistoryStatusSlot
                  run={run}
                  flow={flow}
                  titleOf={titleOf}
                  hasUpstream={hasUpstream}
                />
              )
            }
            flow={flow}
            onUndo={editing.undoEdit}
            onModeChange={editing.setMode}
            setHover={setHover}
            setLive={editing.setLive}
            setEditingSha={setEditingSha}
          />
        )}
        <p aria-live="polite" className="sr-only">
          {editing.live}
        </p>
        {drag.drag === null ? null : (
          <HistoryDragGhost drag={drag.drag} title={titleOf(drag.drag.sha)} titleOf={titleOf} />
        )}
      </div>
    );

  return (
    <ScrollFade className="min-h-0 flex-1" fadeSize="h-6">
      <div className="flex min-w-0 flex-col gap-4 pb-6">{body}</div>
    </ScrollFade>
  );
};
