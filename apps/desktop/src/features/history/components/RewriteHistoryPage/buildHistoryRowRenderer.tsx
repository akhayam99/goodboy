import type { RefObject } from 'react';
import type { BranchCommit, HistoryStep, HistoryStepPrediction, SessionId } from '@goodboy/types';
import type { CommitActionTarget } from '../../../actions/types';
import type { HistoryApplied } from '../../../../store/slices/history/types';
import { canRemove, combineDown, moveBy, rewordStep, targetOf } from '../../historyPlan';
import type { HistoryGraphModel } from '../../historyGraphModel';
import type { HistoryRowMark } from '../../historyRowMarks';
import { HistoryCommitRow } from './HistoryCommitRow';
import type { HistoryRowView } from './historyRowLine';
import { RewordEditor } from './RewordEditor';
import { focusHistoryRow } from './focusHistoryRow';
import type { HistoryHover } from './useHistoryFocus';
import type { useHistoryEditing } from './useHistoryEditing';
import type { useHistoryPlanDrag } from './useHistoryPlanDrag';
import type { useHistoryScribe } from './useHistoryScribe';

type Params = {
  readonly sessionId: SessionId;
  readonly view: HistoryRowView;
  readonly items: ReadonlyArray<HistoryStep>;
  readonly marks: ReadonlyMap<string, HistoryRowMark>;
  readonly commitBySha: ReadonlyMap<string, BranchCommit>;
  readonly titleOf: (sha: string) => string;
  readonly isDone: boolean;
  readonly isInteractive: boolean;
  readonly applied: HistoryApplied | null;
  readonly conflictStep: HistoryStepPrediction | null;
  readonly headSha: string | null;
  readonly model: HistoryGraphModel;
  readonly prNumber: number | null;
  readonly highlightedRows: ReadonlySet<string>;
  readonly drag: ReturnType<typeof useHistoryPlanDrag>;
  readonly editingSha: string | null;
  readonly expanded: ReadonlySet<string>;
  readonly nowMs: number;
  readonly listRef: RefObject<HTMLElement | null>;
  readonly editing: ReturnType<typeof useHistoryEditing>;
  readonly scribe: ReturnType<typeof useHistoryScribe>;
  readonly setEditingSha: (sha: string | null) => void;
  readonly setHover: (hover: HistoryHover | null) => void;
  readonly toggleExpanded: (sha: string) => void;
};

export const buildHistoryRowRenderer =
  ({
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
  }: Params) =>
  (commit: BranchCommit) => {
    const { arrival, change, foldDown, toggleRemove, setMode, separate } = editing;
    const conflictSha = conflictStep?.sha ?? null;
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
    const target: CommitActionTarget | null = isInteractive
      ? {
          kind: 'commit',
          facts: {
            sha: commit.sha,
            shortSha: commit.shortSha,
            subject: commit.subject,
            isFolded: mark?.into != null,
            isRemoved: mark?.isRemoved === true,
            canRemove: canRemove({ items, sha: commit.sha }),
            canFoldDown:
              step !== undefined &&
              combineDown({ items, sha: commit.sha, mode: 'fixup' }) !== items,
            onRename: () => setEditingSha(commit.sha),
            onFoldDown: () => foldDown({ sha: commit.sha, mode: 'fixup' }),
            onSquashDown: () => foldDown({ sha: commit.sha, mode: 'squash' }),
            onToggleRemove: () => toggleRemove({ sha: commit.sha }),
            onSeparate: () => separate({ sha: commit.sha }),
            onMove: (direction) =>
              change({
                items: moveBy({ items, sha: commit.sha, direction }),
                arrive: { sha: commit.sha, action: 'move' },
                message: `Moved ${titleOf(commit.sha)}`,
              }),
          },
        }
      : null;
    return (
      <HistoryCommitRow
        key={commit.sha}
        sessionId={sessionId}
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
        nowMs={nowMs}
        target={target}
        editor={
          <RewordEditor
            initialMessage={step?.message ?? commit.subject}
            suggestion={scribe.suggestion}
            isSuggesting={scribe.isSuggestingFor(commit.sha)}
            onSuggest={() => scribe.suggest({ commit })}
            onSave={(message) => {
              setEditingSha(null);
              change({
                items: rewordStep({ items, sha: commit.sha, message, original: commit.subject }),
                arrive: { sha: commit.sha, action: 'reword' },
                message: `Renamed ${commit.subject}`,
              });
              focusHistoryRow({ list: listRef.current, sha: commit.sha });
            }}
            onCancel={() => {
              setEditingSha(null);
              focusHistoryRow({ list: listRef.current, sha: commit.sha });
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
        onSeparate={(sha) => separate({ sha })}
        onModeChange={(sha, mode) => setMode({ sha, mode })}
        onToggleExpanded={() => toggleExpanded(commit.sha)}
      />
    );
  };
