export type HistoryKeyHint = {
  readonly keys: ReadonlyArray<string>;
  readonly label: string;
};

export const HISTORY_KEYS: ReadonlyArray<HistoryKeyHint> = [
  { keys: ['Alt ↑', 'Alt ↓'], label: 'Move the commit' },
  { keys: ['C'], label: 'Fixup down' },
  { keys: ['S'], label: 'Squash down' },
  { keys: ['R'], label: 'Reword' },
  { keys: ['⌫'], label: 'Drop commit' },
];
