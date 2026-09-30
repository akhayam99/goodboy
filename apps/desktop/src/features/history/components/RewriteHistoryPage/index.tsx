import { useRef, useState } from 'react';
import { ErrorStrip, Eyebrow, LensEmptyState, PaneShell, Skeleton, cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { useElementWidth } from '../../../../shared/hooks/useElementWidth';
import { keptOrder } from '../../historyPlan';
import { REWRITE_HISTORY_TITLE } from '../../rewriteHistoryTitle';
import { HistoryAfterColumn } from './HistoryAfterColumn';
import { HistoryAppliedResult } from './HistoryAppliedResult';
import { HistoryBackups } from './HistoryBackups';
import { HistoryDragGhost } from './HistoryDragGhost';
import { HistoryFacts } from './HistoryFacts';
import { HistoryLegend } from './HistoryLegend';
import { HistoryNowColumn } from './HistoryNowColumn';
import { HistoryPageActions } from './HistoryPageActions';
import { HistoryPlannedSection } from './HistoryPlannedSection';
import { HistoryStatusSlot } from './HistoryStatusSlot';
import { buildHistoryRowRenderer } from './buildHistoryRowRenderer';
import { historyLaneNodes } from './historyLaneNodes';
import { useHistoryBackupsPanel } from './useHistoryBackupsPanel';
import { useHistoryEditing } from './useHistoryEditing';
import { useHistoryExpanded } from './useHistoryExpanded';
import { useHistoryFocus } from './useHistoryFocus';
import { useHistoryKeys } from './useHistoryKeys';
import { useHistoryPlan } from './useHistoryPlan';
import { useHistoryPlanDrag } from './useHistoryPlanDrag';
import { useHistoryPrediction } from './useHistoryPrediction';
import { useHistoryRows } from './useHistoryRows';
import { useHistoryRunFlow } from './useHistoryRunFlow';
import { useHistoryScribe } from './useHistoryScribe';
import { useAppStore } from '../../../../store';

type Props = {
  readonly sessionId: SessionId;
  readonly worktreePath: string;
};

const NARROW_WIDTH = 760;

export const RewriteHistoryPage = ({ sessionId, worktreePath }: Props) => {
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
    isBusy,
    applied,
    isDone,
    isInteractive,
  } = plan;
  const flow = useHistoryRunFlow({ sessionId, mountId, hasUpstream });
  const backups = useHistoryBackupsPanel({ sessionId });
  const openMountTerminal = useAppStore((s) => s.openMountTerminal);
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

  if (mountId === null || mount === null || flow === null) {
    return (
      <PaneShell title={REWRITE_HISTORY_TITLE} icon={CONCEPT_ICONS.history}>
        <LensEmptyState
          tone={CONCEPT_TONE.history}
          icon={CONCEPT_ICONS.history}
          title="This branch is not in the session"
          description="Pick a branch from the trail to rewrite its history."
        />
      </PaneShell>
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
    highlightedRows,
    drag,
    editingSha,
    expanded,
    nowMs,
    listRef,
    editing,
    scribe,
    setEditingSha,
    setHover,
    toggleExpanded,
  });
  const meta = (
    <span className="flex flex-wrap items-center gap-1.5">
      <span>{mount.mountName}</span>
      <span aria-hidden>·</span>
      <span>{mount.branch}</span>
    </span>
  );
  const actions = (
    <HistoryPageActions
      isBusy={isBusy}
      onRefresh={flow.refresh}
      onShowBackups={backups.showBackups}
      onOpenTerminal={() => openMountTerminal(sessionId, worktreePath)}
    />
  );

  const body =
    draft === null ? (
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-12 w-full rounded-md" />
        ))}
      </div>
    ) : draft.loadError !== null && commits.length === 0 ? (
      <ErrorStrip
        label="this branch's commits"
        error={new Error(draft.loadError)}
        onRetry={flow.refresh}
      />
    ) : commits.length === 0 ? (
      <LensEmptyState
        tone={CONCEPT_TONE.history}
        icon={CONCEPT_ICONS.history}
        title={`Nothing to rewrite on ${mount.branch}`}
        description="This branch has no commits of its own yet."
      />
    ) : (
      <div className="flex flex-col gap-6" onKeyDown={keys.onPageKey}>
        <HistoryFacts
          ownCount={model.ownCount}
          afterCount={isDone ? null : model.afterCount}
          behind={model.behind}
          isOnMain={onto !== null}
          onlineCount={model.onlineCount}
          prNumber={prNumber}
          baseBranch={baseBranch}
        />
        {backups.isShowingBackups ? (
          <HistoryBackups
            worktreePath={worktreePath}
            branch={mount.branch}
            hasUpstream={hasUpstream}
            revision={run?.updatedAt ?? 0}
            onRestore={flow.restoreBackup}
            onClose={backups.hideBackups}
          />
        ) : null}
        <div className="flex flex-col gap-4">
          <div
            ref={stage.ref}
            className={cn(
              'grid items-start gap-3.5',
              !isNarrow && !isDone ? 'grid-cols-[minmax(0,1fr)_300px]' : 'grid-cols-1',
            )}
          >
            <HistoryNowColumn
              view={view}
              isDone={isDone}
              isNarrow={isNarrow}
              narrowView={narrowView}
              afterCount={model.afterCount}
              rows={rows}
              listRef={listRef}
              positions={positions}
              nodes={nodes}
              graph={graph}
              baseSha={draft.baseSha}
              baseBranch={baseBranch}
              onto={onto}
              isInteractive={isInteractive}
              dropTarget={drag.drag?.target ?? null}
              nowMs={nowMs}
              renderRow={renderRow}
              onKeyDown={keys.onRowKey}
              onNarrowViewChange={setNarrowView}
              onStartFromMain={() => {
                if (graph === null) {
                  return;
                }
                editing.change({
                  items,
                  onto: graph.mainHead,
                  message: "Your branch will start from today's main on Apply",
                });
              }}
            />
            {!isNarrow && !isDone ? (
              <HistoryAfterColumn
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
          <HistoryLegend isDone={isDone} />
        </div>
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
    <PaneShell
      title={REWRITE_HISTORY_TITLE}
      icon={CONCEPT_ICONS.history}
      tone={CONCEPT_TONE.history}
      meta={meta}
      actions={actions}
      scroll="body"
    >
      {body}
    </PaneShell>
  );
};
