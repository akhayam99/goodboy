import { tintClasses } from '@goodboy/ui';
import type { HistoryAction } from './historyRowMarks';

export type HistoryActionClasses = {
  readonly text: string;
  readonly mark: string;
  readonly stroke: string;
  readonly fill: string;
  readonly solid: string;
  readonly wash: string;
};

const REMOVE = tintClasses('danger');
const KEEP = tintClasses('success');

export const HISTORY_ACTION_CLASSES: Readonly<Record<HistoryAction, HistoryActionClasses>> = {
  pick: {
    text: KEEP.text,
    mark: `${KEEP.text} ${KEEP.border} bg-fill`,
    stroke: 'stroke-success',
    fill: 'fill-success',
    solid: 'bg-success',
    wash: 'bg-fill',
  },
  fixup: {
    text: 'text-history-fixup',
    mark: 'text-history-fixup border-history-fixup/40 bg-history-fixup/12',
    stroke: 'stroke-history-fixup',
    fill: 'fill-history-fixup',
    solid: 'bg-history-fixup',
    wash: 'bg-history-fixup/12',
  },
  squash: {
    text: 'text-history-squash',
    mark: 'text-history-squash border-history-squash/40 bg-history-squash/12',
    stroke: 'stroke-history-squash',
    fill: 'fill-history-squash',
    solid: 'bg-history-squash',
    wash: 'bg-history-squash/12',
  },
  move: {
    text: 'text-history-move',
    mark: 'text-history-move border-history-move/40 bg-history-move/12',
    stroke: 'stroke-history-move',
    fill: 'fill-history-move',
    solid: 'bg-history-move',
    wash: 'bg-history-move/12',
  },
  reword: {
    text: 'text-muted-foreground',
    mark: 'text-muted-foreground border-border-soft bg-fill',
    stroke: 'stroke-muted-foreground',
    fill: 'fill-muted-foreground',
    solid: 'bg-muted-foreground',
    wash: 'bg-fill',
  },
  drop: {
    text: REMOVE.text,
    mark: `${REMOVE.text} ${REMOVE.border} ${REMOVE.bg}`,
    stroke: 'stroke-danger',
    fill: 'fill-danger',
    solid: 'bg-danger',
    wash: 'bg-fill',
  },
  rebase: {
    text: 'text-faint-foreground',
    mark: 'text-faint-foreground border-border-soft bg-fill',
    stroke: 'stroke-idle',
    fill: 'fill-idle',
    solid: 'bg-idle',
    wash: 'bg-fill',
  },
};
