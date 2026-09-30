import type { SessionDecisionChange, SessionEventPayload } from '@goodboy/types';

type DecisionChangeLine = {
  readonly key: string;
  readonly sign: '+' | '−' | '↺' | null;
  readonly label: string;
  readonly text: string;
  readonly note: string | null;
};

const MAX_LINES = 6;

export const DECISION_DETAIL_LINE_HEIGHT = 20;

const DETAIL_PADDING = 8;

type ChangeParams = {
  readonly change: SessionDecisionChange;
  readonly index: number;
};

const lineOf = ({ change, index }: ChangeParams): DecisionChangeLine | null => {
  const key = `${change.kind}-${change.number}-${index}`;
  switch (change.kind) {
    case 'added':
      return { key, sign: '+', label: `D${change.number}`, text: change.text, note: null };
    case 'replaced':
      return {
        key,
        sign: null,
        label: `D${change.number} → D${change.by}`,
        text: change.text,
        note: change.reason,
      };
    case 'withdrawn':
      return {
        key,
        sign: '−',
        label: `D${change.number}`,
        text: change.text,
        note: change.reason === null ? 'withdrawn' : `withdrawn: ${change.reason}`,
      };
    case 'merged':
      return {
        key,
        sign: null,
        label: `D${change.number} → D${change.into}`,
        text: change.text,
        note: 'merged',
      };
    case 'restored':
      return { key, sign: '↺', label: `D${change.number}`, text: change.text, note: 'restored' };
    case 'reworded':
      return null;
    default: {
      const unreachable: never = change;
      return unreachable;
    }
  }
};

type PayloadParams = {
  readonly payload: SessionEventPayload | null;
};

export type DecisionChangeDetail = {
  readonly lines: ReadonlyArray<DecisionChangeLine>;
  readonly hiddenCount: number;
  readonly numbers: ReadonlyArray<number>;
  readonly height: number;
};

export const decisionChangeDetail = ({ payload }: PayloadParams): DecisionChangeDetail | null => {
  const all = (payload?.decisionChanges ?? []).flatMap((change, index) => {
    const line = lineOf({ change, index });
    return line === null ? [] : [line];
  });
  if (all.length === 0) {
    return null;
  }
  const lines = all.slice(0, MAX_LINES);
  const hiddenCount = all.length - lines.length;
  const numbers = [
    ...new Set(
      (payload?.decisionChanges ?? []).flatMap((change) => {
        if (change.kind === 'replaced') {
          return [change.number, change.by];
        }
        if (change.kind === 'merged') {
          return [change.number, change.into];
        }
        if (change.kind === 'reworded') {
          return [];
        }
        return [change.number];
      }),
    ),
  ];
  const lineCount = lines.length + (hiddenCount > 0 ? 1 : 0) + 1;
  return {
    lines,
    hiddenCount,
    numbers,
    height: lineCount * DECISION_DETAIL_LINE_HEIGHT + DETAIL_PADDING,
  };
};
