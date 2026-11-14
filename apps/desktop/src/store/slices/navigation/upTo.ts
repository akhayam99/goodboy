import { currentStack } from './currentStack';
import { goHistory } from './goHistory';
import { leadRowOf } from './leadRowOf';
import { locationKey } from './locationKey';
import { PLACE_ROWS } from './placeRows';
import type { GetFn, Place, SetFn } from './types';

type Params = {
  readonly to: Place;
};

type MoveParams = Params & {
  readonly set: SetFn;
  readonly get: GetFn;
};

const moveUp = ({ set, get, to }: MoveParams): void => {
  const stack = currentStack(get());
  const previous = stack.entries[stack.index - 1];
  if (previous !== undefined && locationKey(previous) === locationKey({ place: to })) {
    goHistory({ set, get, delta: -1 });
    return;
  }
  get().navigate({ to });
};

export const upTo = (set: SetFn, get: GetFn) => {
  return ({ to }: Params): void => {
    const from = currentStack(get());
    const lead = leadRowOf({ from: from.entries[from.index]?.place ?? null, to });
    moveUp({ set, get, to });
    if (lead === null) {
      return;
    }
    const landed = currentStack(get());
    const rows = landed.entries[landed.index]?.focus.returnRows;
    get().amendFocus({ patch: { returnRows: { ...rows, [PLACE_ROWS.boardLead]: lead } } });
  };
};
