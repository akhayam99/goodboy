import type { IsoDateTime, ProviderRunId, TurnEvent } from '@goodboy/types';
import { blockBoundaryPrefix, continueBoundaryText } from './text-boundary';

export type StreamedTextState = {
  pending: string;
  isBlockOpen: boolean;
};

export type StreamedTextHolder = {
  readonly runId: ProviderRunId;
  streamedText?: StreamedTextState;
};

type StateParams = {
  readonly ctx: StreamedTextHolder;
};

const stateOf = ({ ctx }: StateParams): StreamedTextState => {
  const existing = ctx.streamedText;
  if (existing !== undefined) {
    return existing;
  }
  const created: StreamedTextState = { pending: '', isBlockOpen: false };
  ctx.streamedText = created;
  return created;
};

type DeltaParams = {
  readonly ctx: StreamedTextHolder;
  readonly text: string;
  readonly at: IsoDateTime;
};

export const streamedTextEvents = ({ ctx, text, at }: DeltaParams): ReadonlyArray<TurnEvent> => {
  if (text.length === 0) {
    return [];
  }
  const state = stateOf({ ctx });
  const wasOpen = state.isBlockOpen;
  state.isBlockOpen = true;
  state.pending += text;
  if (wasOpen) {
    continueBoundaryText({ runId: ctx.runId, text });
    return [{ kind: 'assistant_text', runId: ctx.runId, delta: text, at, isPartial: true }];
  }
  const prefix = blockBoundaryPrefix({ runId: ctx.runId, text });
  return [
    { kind: 'assistant_text', runId: ctx.runId, delta: `${prefix}${text}`, at, isPartial: true },
  ];
};

export const closeStreamedBlock = ({ ctx }: StateParams): void => {
  if (ctx.streamedText !== undefined) {
    ctx.streamedText.isBlockOpen = false;
  }
};

export const resetStreamedText = ({ ctx }: StateParams): void => {
  delete ctx.streamedText;
};

type TakeParams = {
  readonly ctx: StreamedTextHolder;
  readonly text: string;
};

export const takeStreamedBlock = ({ ctx, text }: TakeParams): boolean => {
  const state = ctx.streamedText;
  if (state === undefined || state.pending.length === 0 || text.length === 0) {
    return false;
  }
  const at = state.pending.indexOf(text);
  if (at < 0) {
    return false;
  }
  state.pending = state.pending.slice(at + text.length);
  state.isBlockOpen = false;
  return true;
};
