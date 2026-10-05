import type { ReactNode } from 'react';
import { historyEditText } from '../../historyEditText';
import type { HistoryEdit } from '../../historyEdits';
import type { HistoryGraphModel } from '../../historyGraphModel';
import type { CombineMode } from '../../historyPlan';
import { HistoryPlannedChanges, type HistoryConflict } from './HistoryPlannedChanges';
import type { HistoryHover } from './useHistoryFocus';
import type { useHistoryRunFlow } from './useHistoryRunFlow';

type Props = {
  readonly edits: ReadonlyArray<HistoryEdit>;
  readonly titleOf: (sha: string) => string;
  readonly model: HistoryGraphModel;
  readonly highlightedKeys: ReadonlySet<string>;
  readonly conflict: HistoryConflict | null;
  readonly isPredictionSupported: boolean;
  readonly hasUpstream: boolean;
  readonly prNumber: number | null;
  readonly dirtyCount: number;
  readonly isInteractive: boolean;
  readonly status: ReactNode;
  readonly flow: NonNullable<ReturnType<typeof useHistoryRunFlow>>;
  readonly onUndo: (edit: HistoryEdit) => void;
  readonly onModeChange: (params: { readonly sha: string; readonly mode: CombineMode }) => void;
  readonly setHover: (hover: HistoryHover | null) => void;
  readonly setLive: (message: string) => void;
  readonly setEditingSha: (sha: string | null) => void;
};

export const HistoryPlannedSection = ({
  edits,
  titleOf,
  model,
  highlightedKeys,
  conflict,
  isPredictionSupported,
  hasUpstream,
  prNumber,
  dirtyCount,
  isInteractive,
  status,
  flow,
  onUndo,
  onModeChange,
  setHover,
  setLive,
  setEditingSha,
}: Props) => (
  <HistoryPlannedChanges
    edits={edits}
    textOf={(edit) => historyEditText({ edit, titleOf })}
    before={model.ownCount}
    after={model.afterCount}
    highlightedKeys={highlightedKeys}
    conflict={conflict}
    isPredictionSupported={isPredictionSupported}
    touchedOnline={model.touchedOnline}
    hasUpstream={hasUpstream}
    prNumber={prNumber}
    dirtyCount={dirtyCount}
    isInteractive={isInteractive}
    status={status}
    onUndo={onUndo}
    onResetAll={() => {
      setHover(null);
      setLive('All planned changes cleared');
      flow.discard();
    }}
    onHover={(key) => setHover(key === null ? null : { kind: 'edit', key })}
    onModeChange={(sha, mode) => onModeChange({ sha, mode })}
    onApply={(shouldPush) => {
      setHover(null);
      setEditingSha(null);
      flow.apply(shouldPush);
    }}
    onRewriteWithAgent={flow.rewriteWithAgent}
  />
);
