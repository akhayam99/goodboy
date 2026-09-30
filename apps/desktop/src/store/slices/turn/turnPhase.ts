import type { SendTurnResult, TurnPhase } from './types';

export const turnDone = ({ result }: { readonly result: SendTurnResult }): TurnPhase<never> => ({
  isDone: true,
  result,
});

export const turnReady = <T>({ value }: { readonly value: T }): TurnPhase<T> => ({
  isDone: false,
  value,
});
