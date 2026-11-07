import type { TurnEvent, TurnState } from '@goodboy/types';
import { askBatchOf } from '../../../features/permissions/askBatchOf';
import { openPermissionAsksOf } from '../../../features/permissions/openPermissionAsksOf';
import type { ResolvedAsks, SendTurnInput } from '../turn/types';

type Params = {
  readonly events: ReadonlyArray<TurnEvent>;
  readonly turnState: TurnState | null | undefined;
  readonly origin: SendTurnInput['origin'];
  readonly given: ResolvedAsks | undefined;
};

export const resolvedAsksAtWrite = ({ events, turnState, origin, given }: Params): ResolvedAsks => {
  if (given !== undefined) {
    return given;
  }
  return {
    denied: origin === 'operator' ? openPermissionAsksOf({ events, turnState }) : [],
    held: askBatchOf({ events }).answered,
  };
};
