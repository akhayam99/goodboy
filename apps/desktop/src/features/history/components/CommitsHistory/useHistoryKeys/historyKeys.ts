export type HistoryKeyHint = {
  readonly keys: ReadonlyArray<string>;
  readonly label: string;
};

export const HISTORY_KEYS: ReadonlyArray<HistoryKeyHint> = [
  { keys: ['Alt ↑', 'Alt ↓'], label: 'Move the commit' },
  { keys: ['C'], label: 'Fold in' },
  { keys: ['S'], label: 'Combine, keep both' },
  { keys: ['R'], label: 'Rename' },
  { keys: ['⌫'], label: 'Remove' },
];
