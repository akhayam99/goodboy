import type { RefObject } from 'react';
import type { BranchCommit, HistoryStep, HistoryStepPrediction, SessionId } from '@goodboy/types';
import type { CommitActionTarget } from '../../../actions/types';
import type { HistoryAbsorbed, HistoryApplied } from '../../../../store/slices/history/types';
import { APPLIED_LIST_LIMIT } from '../../groupAppliedEdits';
import { canRemove, combineDown, rewordStep, targetOf } from '../../historyPlan';
import type { HistoryGraphModel } from '../../historyGraphModel';
import type { HistoryRowMark } from '../../historyRowMarks';
import { HistoryCommitRow } from './HistoryCommitRow';
import type { HistoryRowView } from './historyRowLine';
import { RewordEditor } from './RewordEditor';
import { focusHistoryRow } from './focusHistoryRow';
import type { useHistoryEditing } from './useHistoryEditing';
import type { useHistoryPlanDrag } from './useHistoryPlanDrag';
import type { HistoryRowCallbacksFor } from './useHistoryRowCallbacks';
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
  readonly callbacksFor: HistoryRowCallbacksFor;
};

const NO_INCLUDES: ReadonlyArray<string> = [];

const NO_ABSORBED: ReadonlyArray<HistoryAbsorbed> = [];

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
    callbacksFor,
  }: Params) =>
  (commit: BranchCommit) => {
    const { arrival, change } = editing;
    const callbacks = callbacksFor({ sha: commit.sha });
    const isEditing = editingSha === commit.sha;
    const isGrouped = applied !== null && applied.lines.length > APPLIED_LIST_LIMIT;
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
            onRename: callbacks.onRename,
            onFoldDown: callbacks.onFoldDown,
            onSquashDown: callbacks.onSquashDown,
            onToggleRemove: callbacks.onToggleRemove,
            onSeparate: callbacks.onSeparateSelf,
            onMove: callbacks.onMove,
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
        includes={isGrouped ? NO_INCLUDES : (applied?.includes[commit.sha] ?? NO_INCLUDES)}
        absorbed={isGrouped ? (applied?.absorbed[commit.sha] ?? NO_ABSORBED) : NO_ABSORBED}
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
        isEditing={isEditing}
        isExpanded={expanded.has(commit.sha)}
        nowMs={nowMs}
        target={target}
        editor={
          isEditing ? (
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
          ) : null
        }
        onPointerDown={callbacks.onPointerDown}
        onHover={callbacks.onHover}
        onSeparate={callbacks.onSeparate}
        onModeChange={callbacks.onModeChange}
        onToggleExpanded={callbacks.onToggleExpanded}
      />
    );
  };
