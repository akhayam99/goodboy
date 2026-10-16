import type { TranscriptItem } from './transcript-items';

type Params = {
  readonly isTurnRunning: boolean;
  readonly lastItem: TranscriptItem | undefined;
  readonly isLastClusterRunning: boolean;
};

const ENDS_THE_TURN: ReadonlySet<TranscriptItem['kind']> = new Set([
  'assistant_text',
  'error',
  'auth_required',
  'cli_too_old',
  'done',
]);

export const isTurnThinking = ({
  isTurnRunning,
  lastItem,
  isLastClusterRunning,
}: Params): boolean =>
  isTurnRunning && !ENDS_THE_TURN.has(lastItem?.kind ?? 'user_text') && !isLastClusterRunning;
