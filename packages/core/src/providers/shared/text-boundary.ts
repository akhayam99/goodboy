import type { ProviderRunId } from '@goodboy/types';

type BoundaryState = {
  hasText: boolean;
  trailingNewlines: number;
};

const STATE_BY_RUN = new Map<ProviderRunId, BoundaryState>();

type RunParams = {
  readonly runId: ProviderRunId;
};

const stateFor = ({ runId }: RunParams): BoundaryState => {
  const existing = STATE_BY_RUN.get(runId);
  if (existing !== undefined) {
    return existing;
  }
  const created: BoundaryState = { hasText: false, trailingNewlines: 0 };
  STATE_BY_RUN.set(runId, created);
  return created;
};

type TrailingParams = {
  readonly text: string;
};

const countTrailingNewlines = ({ text }: TrailingParams): number => {
  let count = 0;
  for (let i = text.length - 1; i >= 0 && text[i] === '\n'; i -= 1) {
    count += 1;
  }
  return count;
};

type PrefixParams = {
  readonly runId: ProviderRunId;
  readonly text: string;
};

export const blockBoundaryPrefix = ({ runId, text }: PrefixParams): string => {
  const state = stateFor({ runId });
  const prefix =
    state.hasText && state.trailingNewlines < 2 ? '\n'.repeat(2 - state.trailingNewlines) : '';
  state.hasText = true;
  state.trailingNewlines = countTrailingNewlines({ text: `${prefix}${text}` });
  return prefix;
};

export const resetTextBoundary = ({ runId }: RunParams): void => {
  STATE_BY_RUN.delete(runId);
};
