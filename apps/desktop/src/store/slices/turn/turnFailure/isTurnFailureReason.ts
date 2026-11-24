import type { TurnFailureReason } from '../types';

const TURN_FAILURE_REASONS: ReadonlyArray<string | null> = [
  'model_not_available',
  'authentication',
] satisfies ReadonlyArray<TurnFailureReason>;

type Params = {
  readonly reason: string | null;
};

export const isTurnFailureReason = ({ reason }: Params): boolean =>
  TURN_FAILURE_REASONS.includes(reason);
