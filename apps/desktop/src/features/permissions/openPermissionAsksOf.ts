import type { TurnEvent, TurnState } from '@goodboy/types';
import { askBatchOf, type AskBatch } from './askBatchOf';

export type OpenPermissionAsk = AskBatch['open'][number];

type Params = {
  readonly events: ReadonlyArray<TurnEvent>;
  readonly turnState: TurnState | null | undefined;
};

const NO_ASKS: ReadonlyArray<OpenPermissionAsk> = [];

export const openPermissionAsksOf = ({
  events,
  turnState,
}: Params): ReadonlyArray<OpenPermissionAsk> =>
  turnState?.kind === 'blocked' ? askBatchOf({ events }).open : NO_ASKS;
