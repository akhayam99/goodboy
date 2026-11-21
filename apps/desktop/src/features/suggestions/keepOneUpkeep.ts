import type { NextMove } from './types';

type Params = {
  readonly moves: ReadonlyArray<NextMove>;
};

export const keepOneUpkeep = ({ moves }: Params): ReadonlyArray<NextMove> => {
  const rest = moves.filter((move) => move.group !== 'upkeep');
  if (rest.length > 0) {
    return rest;
  }
  const upkeep = moves.find((move) => move.group === 'upkeep');
  return upkeep === undefined ? [] : [upkeep];
};
