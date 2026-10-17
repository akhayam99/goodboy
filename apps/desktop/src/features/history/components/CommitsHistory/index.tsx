import { useRef, useState } from 'react';
import { Button, Notice, EmptyState, PageColumn, ScrollFade, SkeletonRow } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { useElementWidth } from '../../../../shared/hooks/useElementWidth';
import { loadStateOf } from '../../../../shared/lib/loadStateOf';
import { HistoryActions } from './HistoryActions';
import { HistoryDragGhost } from './HistoryDragGhost';
import { HistoryKeysHint } from './HistoryKeysHint';
import { HistoryNowColumn } from './HistoryNowColumn';
import { HistoryStatusSlot } from './HistoryStatusSlot';
import { HistoryVersionsLink } from './HistoryVersionsLink';
import { buildHistoryRowRenderer } from './buildHistoryRowRenderer';
import { historyLaneNodes } from './historyLaneNodes';
import { useHistoryVersionsDrawer } from './useHistoryVersionsDrawer';
import { useHistoryEditing } from './useHistoryEditing';
import { useHistoryExpanded } from './useHistoryExpanded';
import { useHistoryFocus } from './useHistoryFocus';
import { useHistoryKeys } from './useHistoryKeys';
import { useHistoryPlan } from './useHistoryPlan';
import { useHistoryPlanDrag } from './useHistoryPlanDrag';
import { useHistoryRowCallbacks } from './useHistoryRowCallbacks';
import { useHistoryRows } from './useHistoryRows';
import { useHistoryRunFlow } from './useHistoryRunFlow';
import { useHistoryScribe } from './useHistoryScribe';
import { useHistoryBackupCount } from '../../useHistoryBackupCount';
import { useHistoryLiveSession } from './useHistoryLiveSession';
import { HistoryLiveNotice } from './HistoryLiveNotice';
import { TabActions } from '../../../../shared/components/TabActions';

type Props = {
  readonly sessionId: SessionId;
  readonly worktreePath: string;
  readonly isReadOnly?: boolean;
};

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
    graph,
    commitBySha,
    titleOf,
    marks,
    edits,
    model,
    chosenBase,
    hasUpstream,
    applied,
    isDone,
    isInteractive: isEditable,
  } = plan;
  const { live, undo, redo } = useHistoryLiveSession({ sessionId, mountId, isReadOnly });
  const isInteractive = isEditable && !isReadOnly && live?.isBusy !== true;
  const flow = useHistoryRunFlow({ sessionId, mountId, hasUpstream });
  const versionsDrawer = useHistoryVersionsDrawer({ sessionId, mountId, worktreePath });
  const backupCount = useHistoryBackupCount({
    worktreePath,
    branch: mount?.branch ?? '',
    revision: run?.updatedAt ?? 0,
  });
  const [editingSha, setEditingSha] = useState<string | null>(null);
  const [nowMs] = useState(() => Date.now());
  const { expanded, toggleExpanded } = useHistoryExpanded();
  const listRef = useRef<HTMLDivElement | null>(null);
  const stage = useElementWidth();
  const { setHover, highlightedRows } = useHistoryFocus({
    edits,
    marks,
    run,
    isDone,
  });
  const editing = useHistoryEditing({
    sessionId,
    mountId,
    items,
    original: plan.original,
    titleOf,
    clearHover: () => setHover(null),
  });
  const view = 'now';
  const workingSha = live?.busySha ?? null;
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
  const headSha = model.headSha;
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
    conflictStep: null,
    workingSha,
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
  const hasHistory = (live?.undo.length ?? 0) > 0 || (live?.redo.length ?? 0) > 0;
  const actions = !hasHistory ? null : (
    <HistoryActions
      canUndo={(live?.undo.length ?? 0) > 0}
      canRedo={(live?.redo.length ?? 0) > 0}
      isBusy={live?.isBusy === true || plan.isBusy}
      isReadOnly={isReadOnly}
      onUndo={undo}
      onRedo={redo}
    />
  );

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
        size="page"
        icon={CONCEPT_ICONS.history}
        title="No commits yet"
        description={
          draft?.baseSha === undefined || draft.baseSha === ''
            ? undefined
            : `Based on ${chosenBase ?? 'main'} at ${draft.baseSha.slice(0, 7)}.`
        }
      />
    ) : (
      <div className="flex flex-col gap-6" onKeyDown={keys.onPageKey}>
        <HistoryLiveNotice sessionId={sessionId} mountId={mountId} live={live} />
        {run === null ? null : (
          <HistoryStatusSlot run={run} flow={flow} titleOf={titleOf} hasUpstream={hasUpstream} />
        )}
        <div className="flex flex-col gap-4">
          <div ref={stage.ref} className="grid grid-cols-1 items-start">
            <HistoryNowColumn
              sessionId={sessionId}
              repoPath={mount.repoRoot}
              ownBranch={mount.branch}
              onRebase={flow.rebaseOnto}
              view={view}
              isDone={isDone}
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
            />
          </div>
        </div>
        {backupCount > 0 ? (
          <HistoryVersionsLink count={backupCount} onOpen={versionsDrawer.showVersions} />
        ) : null}
        {isInteractive && !isDone ? <HistoryKeysHint /> : null}
        <p aria-live="polite" className="sr-only">
          {editing.live}
        </p>
        {drag.drag === null ? null : (
          <HistoryDragGhost drag={drag.drag} title={titleOf(drag.drag.sha)} titleOf={titleOf} />
        )}
      </div>
    );

  return (
    <>
      <TabActions>{actions}</TabActions>
      <ScrollFade className="min-h-0 flex-1" fadeSize="h-6">
        <div className="flex min-w-0 flex-col gap-4 pb-6">{body}</div>
      </ScrollFade>
    </>
  );
};
