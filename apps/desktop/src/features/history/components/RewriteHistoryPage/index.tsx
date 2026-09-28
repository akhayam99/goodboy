import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { RefreshCw, SquareTerminal } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import {
  Button,
  ErrorStrip,
  Eyebrow,
  LensEmptyState,
  Notice,
  OverflowMenu,
  SegmentedTabs,
  Skeleton,
  cn,
  type OverflowMenuItem,
} from '@goodboy/ui';
import type { BranchCommit, HistoryStep, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useWorktreeStatuses } from '../../../session/hooks/useWorktreeStatuses';
import { selectMountForPath } from '../../../../store/slices/project-mounts/selectors';
import { scribeKeyOf } from '../../../../store/slices/scribe/scribeKeyOf';
import { isHistoryRunActive } from '../../../../store/slices/history/isHistoryRunActive';
import { PaneShell } from '../../../../shared/components/PaneShell';
import { CONCEPT_ICONS, CONCEPT_TONE, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useElementWidth } from '../../../../shared/hooks/useElementWidth';
import { useFlipList } from '../../../../shared/hooks/useFlipList';
import {
  deriveHistoryEdits,
  invertHistoryEdit,
  rowsOfEdit,
  type HistoryEdit,
} from '../../historyEdits';
import { historyEditText } from '../../historyEditText';
import { historyGraphModel } from '../../historyGraphModel';
import {
  canCombine,
  canRemove,
  combineDown,
  combineInto,
  isFolded,
  keptOrder,
  moveAbove,
  moveBy,
  planOrder,
  resetStep,
  rewordStep,
  setCombineMode,
  setVerb,
  slotAnchorIsNoop,
  targetOf,
  type CombineMode,
} from '../../historyPlan';
import { historyRowMarks, type HistoryAction } from '../../historyRowMarks';
import { REWRITE_HISTORY_TITLE } from '../../rewriteHistoryTitle';
import { useHistoryDrag } from '../../useHistoryDrag';
import { useRowPositions } from '../../useRowPositions';
import { HistoryAfterGraph } from './HistoryAfterGraph';
import { HistoryBackups } from './HistoryBackups';
import { HistoryCommitRow } from './HistoryCommitRow';
import { HistoryDragGhost } from './HistoryDragGhost';
import { HistoryFacts } from './HistoryFacts';
import type { LaneNode } from './HistoryLaneSvg';
import { HistoryLegend } from './HistoryLegend';
import { HistoryNowList } from './HistoryNowList';
import { HistoryPlannedChanges, type HistoryConflict } from './HistoryPlannedChanges';
import { HistoryResult } from './HistoryResult';
import { HistoryRunStatus } from './HistoryRunStatus';
import { RewordEditor } from './RewordEditor';

type Props = {
  readonly sessionId: SessionId;
  readonly worktreePath: string;
};

type Hover =
  { readonly kind: 'row'; readonly sha: string } | { readonly kind: 'edit'; readonly key: string };

type Arrival = {
  readonly sha: string;
  readonly action: HistoryAction;
  readonly nonce: number;
};

type ChangeParams = {
  readonly items: ReadonlyArray<HistoryStep>;
  readonly onto?: string | null;
  readonly arrive?: { readonly sha: string; readonly action: HistoryAction } | null;
  readonly message: string;
};

const EMPTY_ITEMS: ReadonlyArray<HistoryStep> = [];
const EMPTY_COMMITS: ReadonlyArray<BranchCommit> = [];
const NARROW_WIDTH = 760;
const NOW_VIEW_OPTIONS = [
  { value: 'now', label: 'Now' },
  { value: 'planned', label: 'After Apply' },
] as const;

const focusRow = ({ list, sha }: { readonly list: HTMLElement | null; readonly sha: string }) => {
  const row = list?.querySelector<HTMLElement>(`[data-history-row="${sha}"]`) ?? null;
  row?.focus({ preventScroll: false });
};

export const RewriteHistoryPage = ({ sessionId, worktreePath }: Props) => {
  const mount = useAppStore(
    useShallow((s) => selectMountForPath({ state: s, sessionId, path: worktreePath })),
  );
  const mountId = mount?.mountId ?? null;
  const draft = useAppStore((s) => (mountId === null ? null : (s.historyDrafts[mountId] ?? null)));
  const run = useAppStore((s) => (mountId === null ? null : (s.historyRuns[mountId] ?? null)));
  const scribe = useAppStore((s) =>
    mountId === null
      ? null
      : (s.scribeWork[scribeKeyOf({ mountId, kind: 'commit-message' })] ?? null),
  );
  const prNumber = useAppStore((s) =>
    mountId === null ? null : (s.mountGithub[mountId]?.pr?.number ?? null),
  );
  const prHeadSha = useAppStore((s) =>
    mountId === null ? null : (s.mountGithub[mountId]?.pr?.headSha ?? null),
  );
  const loadHistoryDraft = useAppStore((s) => s.loadHistoryDraft);
  const editHistoryDraft = useAppStore((s) => s.editHistoryDraft);
  const undoHistoryDraft = useAppStore((s) => s.undoHistoryDraft);
  const discardHistoryDraft = useAppStore((s) => s.discardHistoryDraft);
  const applyHistoryDraft = useAppStore((s) => s.applyHistoryDraft);
  const applyRewrittenHistory = useAppStore((s) => s.applyRewrittenHistory);
  const rewriteDraftWithAgent = useAppStore((s) => s.rewriteDraftWithAgent);
  const pushHistoryRewrite = useAppStore((s) => s.pushHistoryRewrite);
  const restoreHistory = useAppStore((s) => s.restoreHistory);
  const bringOriginIntoHistory = useAppStore((s) => s.bringOriginIntoHistory);
  const dismissHistoryRun = useAppStore((s) => s.dismissHistoryRun);
  const requestScribe = useAppStore((s) => s.requestScribe);
  const openMountTerminal = useAppStore((s) => s.openMountTerminal);
  const [editingSha, setEditingSha] = useState<string | null>(null);
  const [scribeFor, setScribeFor] = useState<string | null>(null);
  const [isShowingBackups, setIsShowingBackups] = useState(false);
  const [narrowView, setNarrowView] = useState<'now' | 'planned'>('now');
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [hover, setHover] = useState<Hover | null>(null);
  const [arrival, setArrival] = useState<Arrival | null>(null);
  const [live, setLive] = useState('');
  const [nowMs] = useState(() => Date.now());
  const listRef = useRef<HTMLDivElement | null>(null);
  const stage = useElementWidth();

  useEffect(() => {
    if (mountId === null) {
      return;
    }
    void loadHistoryDraft({ sessionId, mountId });
  }, [loadHistoryDraft, mountId, sessionId]);

  const items = draft?.items ?? EMPTY_ITEMS;
  const commits = draft?.commits ?? EMPTY_COMMITS;
  const onto = draft?.onto ?? null;
  const graph = draft?.graph ?? null;
  const original = useMemo(() => [...commits].reverse().map((commit) => commit.sha), [commits]);
  const commitBySha = useMemo(
    () => new Map(commits.map((commit) => [commit.sha, commit])),
    [commits],
  );
  const titleOf = (sha: string): string => commitBySha.get(sha)?.subject ?? sha.slice(0, 7);
  const marks = useMemo(() => historyRowMarks({ items, original }), [items, original]);
  const edits = useMemo(
    () => deriveHistoryEdits({ items, original, onto, behind: graph?.behind ?? 0 }),
    [graph?.behind, items, onto, original],
  );
  const model = historyGraphModel({ commits, items, original, onto, graph, prHeadSha });
  const statusTargets = useMemo(
    () => [{ worktreePath, baseBranch: mount?.baseBranch ?? undefined }],
    [mount?.baseBranch, worktreePath],
  );
  const status = useWorktreeStatuses({ targets: statusTargets }).get(worktreePath) ?? null;
  const hasUpstream =
    status !== null ? status.upstream !== null || graph?.remoteSha != null : model.onlineCount > 0;
  const dirtyCount =
    status === null || status.workingTree.kind !== 'known'
      ? 0
      : status.workingTree.staged + status.workingTree.unstaged + status.workingTree.unmerged;
  const isBusy = run !== null && isHistoryRunActive({ phase: run.phase });
  const applied = run !== null && run.phase !== 'restored' ? run.applied : null;
  const isDone = applied !== null;
  const isInteractive = draft !== null && !isBusy && !isDone && commits.length > 0;
  const isNarrow = stage.width !== null && stage.width < NARROW_WIDTH;
  const view = isDone ? 'done' : isNarrow && narrowView === 'planned' ? 'planned' : 'now';
  const workingSha =
    run?.phase === 'trying' && run.progress?.stage === 'step' ? run.progress.sha : null;

  const conflictStep = draft?.prediction?.steps.find((step) => step.outcome === 'conflict') ?? null;
  const conflict: HistoryConflict | null = useMemo(() => {
    if (conflictStep === null) {
      return null;
    }
    const filesOf = new Map((graph?.files ?? []).map((entry) => [entry.sha, entry.files]));
    const keys = new Set(
      edits
        .filter((edit) => {
          if (rowsOfEdit({ edit }).includes(conflictStep.sha)) {
            return true;
          }
          return (
            edit.kind === 'drop' &&
            (filesOf.get(edit.sha) ?? []).some((file) => conflictStep.files.includes(file))
          );
        })
        .map((edit) => edit.key),
    );
    if (keys.size === 0 && onto !== null) {
      keys.add('rebase');
    }
    return { files: conflictStep.files, editKeys: keys };
  }, [conflictStep, edits, graph?.files, onto]);

  const rows = useMemo(() => {
    if (view !== 'planned') {
      return commits;
    }
    return [...planOrder({ items })].reverse().flatMap((sha) => {
      const commit = commitBySha.get(sha);
      return commit === undefined ? [] : [commit];
    });
  }, [commitBySha, commits, items, view]);
  const orderKey = rows.map((commit) => commit.sha).join(',');
  const positions = useRowPositions({
    listRef,
    layoutKey: `${orderKey}|${view}|${editingSha ?? ''}|${[...expanded].join(',')}|${stage.width ?? 0}|${edits.length}`,
  });
  useFlipList({ containerRef: listRef, orderKey: `${view}:${orderKey}` });

  const stopSha = run !== null && run.phase === 'stopped' ? (run.stop?.sha ?? null) : null;
  const focus: Hover | null =
    hover ?? (stopSha === null || isDone ? null : { kind: 'row', sha: stopSha });
  const highlightedRows = useMemo(() => {
    const hover = focus;
    if (hover === null) {
      return new Set<string>();
    }
    if (hover.kind === 'row') {
      return new Set([hover.sha]);
    }
    const edit = edits.find((candidate) => candidate.key === hover.key);
    return new Set(edit === undefined ? [] : rowsOfEdit({ edit }));
  }, [edits, focus]);
  const highlightedEdits = useMemo(() => {
    const hover = focus;
    if (hover === null) {
      return new Set<string>();
    }
    if (hover.kind === 'edit') {
      return new Set([hover.key]);
    }
    return new Set(
      edits.filter((edit) => rowsOfEdit({ edit }).includes(hover.sha)).map((edit) => edit.key),
    );
  }, [edits, focus]);

  const change = ({ items: next, onto: nextOnto, arrive = null, message }: ChangeParams) => {
    if (mountId === null) {
      return;
    }
    const isSameOnto = nextOnto === undefined || nextOnto === onto;
    if (next === items && isSameOnto) {
      return;
    }
    if (arrive !== null) {
      setArrival({ ...arrive, nonce: Date.now() });
    }
    setLive(message);
    void editHistoryDraft({
      sessionId,
      mountId,
      items: next,
      ...(nextOnto === undefined ? {} : { onto: nextOnto }),
    });
  };

  const drag = useHistoryDrag({
    listRef,
    isEnabled: isInteractive && editingSha === null,
    canDrag: (sha) => {
      const step = items.find((candidate) => candidate.sha === sha);
      return step !== undefined && !isFolded({ step });
    },
    isAnchor: (sha) => {
      const step = items.find((candidate) => candidate.sha === sha);
      return step !== undefined && !isFolded({ step });
    },
    canDropInto: ({ sha, target }) => canCombine({ items, sha, target }),
    isNoopSlot: ({ sha, anchor }) => slotAnchorIsNoop({ items, sha, anchor }),
    onMove: ({ sha, anchor }) =>
      change({
        items: moveAbove({ items, sha, anchor }),
        arrive: { sha, action: 'move' },
        message: `Moved ${titleOf(sha)}`,
      }),
    onCombine: ({ sha, target }) =>
      change({
        items: combineInto({ items, sha, target, mode: 'fixup' }),
        arrive: { sha: target, action: 'fixup' },
        message: `Folded ${titleOf(sha)} into ${titleOf(target)}, keeping its title`,
      }),
    onPickUp: (sha) => {
      setHover(null);
      setLive(`Picked up ${titleOf(sha)}`);
    },
    onCancel: () => setLive('Cancelled'),
  });

  if (mountId === null || mount === null) {
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

  const baseBranch = mount.baseBranch ?? 'main';
  const foldDown = ({ sha, mode }: { readonly sha: string; readonly mode: CombineMode }) => {
    const next = combineDown({ items, sha, mode });
    if (next === items) {
      setLive('Nothing below to combine with');
      return;
    }
    const target =
      targetOf({ step: next.find((step) => step.sha === sha) ?? { sha, verb: 'pick' } }) ?? sha;
    change({
      items: next,
      arrive: { sha: target, action: mode },
      message:
        mode === 'fixup'
          ? `Folded ${titleOf(sha)} into ${titleOf(target)}, keeping its title`
          : `Combined ${titleOf(sha)} with ${titleOf(target)}, both messages kept`,
    });
  };
  const toggleRemove = ({ sha }: { readonly sha: string }) => {
    const step = items.find((candidate) => candidate.sha === sha);
    if (step === undefined) {
      return;
    }
    if (step.verb === 'drop') {
      change({ items: resetStep({ items, sha }), message: `Kept ${titleOf(sha)}` });
      return;
    }
    if (!canRemove({ items, sha })) {
      setLive('Separate what it takes in first');
      return;
    }
    change({
      items: setVerb({ items, sha, verb: 'drop' }),
      arrive: { sha, action: 'drop' },
      message: `Removed ${titleOf(sha)}`,
    });
  };
  const setMode = ({ sha, mode }: { readonly sha: string; readonly mode: CombineMode }) =>
    change({
      items: setCombineMode({ items, sha, mode }),
      message:
        mode === 'fixup' ? 'Keeps only the target title (fixup)' : 'Keeps both messages (squash)',
    });
  const separate = ({ sha }: { readonly sha: string }) =>
    change({ items: resetStep({ items, sha }), message: `Separated ${titleOf(sha)}` });
  const undoEdit = (edit: HistoryEdit) => {
    setHover(null);
    if (edit.kind === 'rebase') {
      change({ items, onto: null, message: 'Undone' });
      return;
    }
    change({ items: invertHistoryEdit({ items, original, edit }), message: 'Undone' });
  };
  const onRowKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || target.dataset.historyRow === undefined) {
      return;
    }
    const sha = target.dataset.historyRow;
    const key = event.key;
    const lower = key.toLowerCase();
    if (!isInteractive) {
      return;
    }
    if (event.altKey && (key === 'ArrowUp' || key === 'ArrowDown')) {
      event.preventDefault();
      const next = moveBy({ items, sha, direction: key === 'ArrowUp' ? 'newer' : 'older' });
      change({ items: next, arrive: { sha, action: 'move' }, message: `Moved ${titleOf(sha)}` });
      return;
    }
    if (key === 'ArrowUp' || key === 'ArrowDown') {
      event.preventDefault();
      const index = rows.findIndex((commit) => commit.sha === sha);
      const next = rows[index + (key === 'ArrowUp' ? -1 : 1)];
      if (next !== undefined) {
        focusRow({ list: listRef.current, sha: next.sha });
      }
      return;
    }
    if (event.metaKey || event.ctrlKey) {
      return;
    }
    if (lower === 'c' || lower === 'f' || lower === 's') {
      event.preventDefault();
      foldDown({ sha, mode: lower === 's' ? 'squash' : 'fixup' });
      return;
    }
    if (lower === 'r' || key === 'Enter') {
      event.preventDefault();
      setEditingSha(sha);
      return;
    }
    if (key === 'Backspace' || key === 'Delete' || lower === 'd') {
      event.preventDefault();
      toggleRemove({ sha });
    }
  };
  const onPageKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const isUndo = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z';
    const target = event.target;
    const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
    if (!isUndo || isTyping || !isInteractive) {
      return;
    }
    event.preventDefault();
    void undoHistoryDraft({ sessionId, mountId }).then((isUndone) =>
      setLive(isUndone ? 'Undone' : 'Nothing to undo'),
    );
  };
  const suggest = ({ commit }: { readonly commit: BranchCommit }) => {
    setScribeFor(commit.sha);
    void requestScribe({
      sessionId,
      mountId,
      task: {
        kind: 'commit-message',
        verb: 'reword',
        commits: [{ sha: commit.sha, subject: commit.subject }],
      },
    }).catch(() => undefined);
  };
  const scribeSuggestion =
    scribe?.status === 'ready' && scribeFor !== null && scribeFor === editingSha
      ? (scribe.output?.commitMessages[0]?.message ?? null)
      : null;

  const nodes: ReadonlyArray<LaneNode> = rows.map((commit) => {
    const mark = marks.get(commit.sha);
    const includes = applied?.includes[commit.sha] ?? [];
    return {
      key: commit.sha,
      y: positions.y.get(commit.sha) ?? 0,
      color: isDone ? 'lane' : (mark?.action ?? 'pick'),
      ring: isDone
        ? includes.length > 0
          ? 'lane'
          : null
        : mark !== undefined && mark.into === null && mark.takesIn.length > 0
          ? mark.takesInMode
          : null,
      isHighlighted: highlightedRows.has(commit.sha),
      isWorking: workingSha === commit.sha,
    };
  });
  const headSha =
    view === 'planned' ? ([...keptOrder({ items })].reverse()[0] ?? model.headSha) : model.headSha;
  const conflictSha = conflictStep?.sha ?? null;
  const renderRow = (commit: BranchCommit) => {
    const step = items.find((candidate) => candidate.sha === commit.sha);
    const mark = isDone ? null : (marks.get(commit.sha) ?? null);
    const carrier =
      conflictSha === null
        ? null
        : view === 'planned'
          ? (targetOf({
              step: items.find((candidate) => candidate.sha === conflictSha) ?? {
                sha: conflictSha,
                verb: 'pick',
              },
            }) ?? conflictSha)
          : conflictSha;
    const takenIn = (mark?.takesIn ?? []).flatMap((taken) => {
      const found = commitBySha.get(taken.sha);
      return found === undefined ? [] : [{ commit: found, mode: taken.mode }];
    });
    return (
      <HistoryCommitRow
        key={commit.sha}
        commit={commit}
        view={view}
        mark={mark}
        titleOf={titleOf}
        conflictFiles={!isDone && carrier === commit.sha ? (conflictStep?.files ?? []) : []}
        includes={applied?.includes[commit.sha] ?? []}
        takenIn={takenIn}
        pills={{
          isHead: commit.sha === headSha,
          remote:
            commit.sha === model.remoteRowSha
              ? !isDone && model.touchedOnline > 0
                ? 'old'
                : 'current'
              : null,
          prNumber: commit.sha === model.prRowSha ? prNumber : null,
        }}
        isNew={
          isDone && (applied?.newShas.includes(commit.sha) ?? false) && commit.pushed === false
        }
        isHighlighted={highlightedRows.has(commit.sha)}
        isLifted={drag.drag?.sha === commit.sha}
        isDropInto={drag.drag?.target?.mode === 'into' && drag.drag.target.sha === commit.sha}
        arrival={arrival !== null && arrival.sha === commit.sha ? arrival : null}
        isInteractive={isInteractive}
        isEditing={editingSha === commit.sha}
        isExpanded={expanded.has(commit.sha)}
        canRemove={canRemove({ items, sha: commit.sha })}
        canFoldDown={
          step !== undefined && combineDown({ items, sha: commit.sha, mode: 'fixup' }) !== items
        }
        nowMs={nowMs}
        editor={
          <RewordEditor
            initialMessage={step?.message ?? commit.subject}
            suggestion={scribeSuggestion}
            isSuggesting={scribe?.status === 'writing' && scribeFor === commit.sha}
            onSuggest={() => suggest({ commit })}
            onSave={(message) => {
              setEditingSha(null);
              change({
                items: rewordStep({ items, sha: commit.sha, message, original: commit.subject }),
                arrive: { sha: commit.sha, action: 'reword' },
                message: `Renamed ${commit.subject}`,
              });
              focusRow({ list: listRef.current, sha: commit.sha });
            }}
            onCancel={() => {
              setEditingSha(null);
              focusRow({ list: listRef.current, sha: commit.sha });
            }}
          />
        }
        onPointerDown={(event) => drag.onPointerDown(event, commit.sha)}
        onHover={(isOver) => {
          if (drag.drag !== null) {
            return;
          }
          setHover(isOver ? { kind: 'row', sha: commit.sha } : null);
        }}
        onRename={() => setEditingSha(commit.sha)}
        onFoldDown={() => foldDown({ sha: commit.sha, mode: 'fixup' })}
        onToggleRemove={() => toggleRemove({ sha: commit.sha })}
        onSeparate={(sha) => separate({ sha })}
        onModeChange={(sha, mode) => setMode({ sha, mode })}
        onToggleExpanded={() =>
          setExpanded((current) => {
            const next = new Set(current);
            if (next.has(commit.sha)) {
              next.delete(commit.sha);
              return next;
            }
            next.add(commit.sha);
            return next;
          })
        }
      />
    );
  };

  const overflow: OverflowMenuItem[] = [
    {
      kind: 'item',
      key: 'backups',
      label: 'Backups',
      icon: CONCEPT_ICONS.backup,
      onClick: () => setIsShowingBackups(true),
    },
    {
      kind: 'item',
      key: 'terminal',
      label: 'Open terminal here',
      icon: SquareTerminal,
      onClick: () => openMountTerminal(sessionId, worktreePath),
    },
  ];
  const meta = (
    <span className="flex flex-wrap items-center gap-1.5">
      <span>{mount.mountName}</span>
      <span aria-hidden>·</span>
      <span>{mount.branch}</span>
    </span>
  );
  const actions = (
    <>
      <Button
        size="sm"
        variant="ghost"
        disabled={isBusy}
        onClick={() => void loadHistoryDraft({ sessionId, mountId })}
      >
        <RefreshCw size={ICON_SIZE.row} aria-hidden />
        Refresh
      </Button>
      <OverflowMenu items={overflow} label="More history actions" align="right" />
    </>
  );
  const keep = [...keptOrder({ items })];
  const status_ =
    run === null ? null : run.phase === 'restored' ? (
      <Notice
        tone="info"
        placement="inline"
        title="Restored the previous history"
        body="The history you left is kept as a backup too."
        actions={
          <Button
            size="sm"
            variant="ghost"
            onClick={() => dismissHistoryRun({ sessionId, mountId })}
          >
            Dismiss
          </Button>
        }
      />
    ) : (
      <HistoryRunStatus
        run={run}
        titleOf={titleOf}
        hasUpstream={hasUpstream}
        onRewriteWithAgent={() => void rewriteDraftWithAgent({ sessionId, mountId })}
        onApplyRewritten={(shouldPush) =>
          void applyRewrittenHistory({ sessionId, mountId, shouldPush })
        }
        onDismiss={() => dismissHistoryRun({ sessionId, mountId })}
        onRefresh={() => void loadHistoryDraft({ sessionId, mountId })}
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
        onRetry={() => void loadHistoryDraft({ sessionId, mountId })}
      />
    ) : commits.length === 0 ? (
      <LensEmptyState
        tone={CONCEPT_TONE.history}
        icon={CONCEPT_ICONS.history}
        title={`Nothing to rewrite on ${mount.branch}`}
        description="This branch has no commits of its own yet."
      />
    ) : (
      <div className="flex flex-col gap-6" onKeyDown={onPageKey}>
        <HistoryFacts
          ownCount={model.ownCount}
          afterCount={isDone ? null : model.afterCount}
          behind={model.behind}
          isOnMain={onto !== null}
          onlineCount={model.onlineCount}
          prNumber={prNumber}
          baseBranch={baseBranch}
        />
        {isShowingBackups ? (
          <HistoryBackups
            worktreePath={worktreePath}
            branch={mount.branch}
            hasUpstream={hasUpstream}
            revision={run?.updatedAt ?? 0}
            onRestore={(backup) =>
              void restoreHistory({
                sessionId,
                mountId,
                backupRef: backup.refName,
                shouldPush: hasUpstream,
              })
            }
            onClose={() => setIsShowingBackups(false)}
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
            <div className="flex min-w-0 flex-col gap-2" onKeyDown={onRowKey}>
              <div className="flex h-6 items-center gap-2 pl-2">
                {isDone ? null : (
                  <>
                    <Eyebrow label={view === 'planned' ? 'After Apply' : 'Now'} muted />
                    <span className="text-label text-faint-foreground">
                      {view === 'planned'
                        ? `${model.afterCount} ${model.afterCount === 1 ? 'commit' : 'commits'}`
                        : 'your branch as it is'}
                    </span>
                  </>
                )}
                <span className="flex-1" />
                {isNarrow && !isDone ? (
                  <SegmentedTabs
                    size="sm"
                    ariaLabel="Show"
                    options={NOW_VIEW_OPTIONS}
                    value={narrowView}
                    onChange={(next) => setNarrowView(next)}
                  />
                ) : null}
              </div>
              <HistoryNowList
                view={view}
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
                onStartFromMain={() => {
                  if (graph === null) {
                    return;
                  }
                  change({
                    items,
                    onto: graph.mainHead,
                    message: "Your branch will start from today's main on Apply",
                  });
                }}
              />
            </div>
            {!isNarrow && !isDone ? (
              <div className="flex min-w-0 flex-col gap-2 self-stretch rounded-lg bg-subtle pb-2 pl-2 pr-3">
                <div className="flex h-6 items-center gap-2 pl-2">
                  <Eyebrow label="After Apply" muted />
                  <span className="text-label text-faint-foreground">
                    {model.afterCount} {model.afterCount === 1 ? 'commit' : 'commits'}
                  </span>
                </div>
                <HistoryAfterGraph
                  keep={keep}
                  marks={marks}
                  positions={positions}
                  isOnMain={onto !== null}
                  highlighted={highlightedRows}
                  workingSha={workingSha}
                  titleOf={(sha) => marks.get(sha)?.renamedTo ?? titleOf(sha)}
                  onHover={(sha) => setHover(sha === null ? null : { kind: 'row', sha })}
                />
              </div>
            ) : null}
          </div>
          <HistoryLegend isDone={isDone} />
        </div>
        {applied !== null && run !== null ? (
          <HistoryResult
            applied={applied}
            phase={run.phase}
            stop={run.stop}
            backupRef={run.backupRef}
            branch={mount.branch}
            nowMs={nowMs}
            hasUpstream={hasUpstream}
            prNumber={prNumber}
            onPush={() =>
              void pushHistoryRewrite({
                sessionId,
                mountId,
                origin: run.origin,
                planId: run.planId,
                expectedRemoteSha: run.remoteSha,
              }).then(() => loadHistoryDraft({ sessionId, mountId }))
            }
            onBringOrigin={() => void bringOriginIntoHistory({ sessionId, mountId })}
            onRestore={() => {
              if (run.backupRef !== null) {
                void restoreHistory({
                  sessionId,
                  mountId,
                  backupRef: run.backupRef,
                  shouldPush: run.phase === 'pushed' && hasUpstream,
                });
              }
            }}
            onDone={() => dismissHistoryRun({ sessionId, mountId })}
          />
        ) : (
          <HistoryPlannedChanges
            edits={edits}
            textOf={(edit) => historyEditText({ edit, titleOf })}
            before={model.ownCount}
            after={model.afterCount}
            highlightedKeys={highlightedEdits}
            conflict={conflict}
            isPredictionSupported={draft.prediction?.isSupported !== false}
            touchedOnline={model.touchedOnline}
            hasUpstream={hasUpstream}
            prNumber={prNumber}
            dirtyCount={dirtyCount}
            isInteractive={isInteractive}
            status={status_}
            onUndo={undoEdit}
            onResetAll={() => {
              setHover(null);
              setLive('All planned changes cleared');
              void discardHistoryDraft({ sessionId, mountId });
            }}
            onHover={(key) => setHover(key === null ? null : { kind: 'edit', key })}
            onModeChange={(sha, mode) => setMode({ sha, mode })}
            onApply={(shouldPush) => {
              setHover(null);
              setEditingSha(null);
              void applyHistoryDraft({ sessionId, mountId, shouldPush });
            }}
            onRewriteWithAgent={() => void rewriteDraftWithAgent({ sessionId, mountId })}
          />
        )}
        <p aria-live="polite" className="sr-only">
          {live}
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
