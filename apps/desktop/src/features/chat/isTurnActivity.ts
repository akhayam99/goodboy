import type { TurnEvent } from '@goodboy/types';

type Params = {
  readonly event: TurnEvent;
};

const TAIL_KINDS: ReadonlySet<TurnEvent['kind']> = new Set([
  'usage',
  'done',
  'unknown_payload',
  'processes_stopped',
  'decision_note',
]);

export const isTurnActivity = ({ event }: Params): boolean => !TAIL_KINDS.has(event.kind);
