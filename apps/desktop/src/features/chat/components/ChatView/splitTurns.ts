import type { ReactNode } from 'react';

type Params = {
  readonly nodes: ReadonlyArray<ReactNode>;
  readonly starts: ReadonlySet<number>;
};

export const splitTurns = ({ nodes, starts }: Params): ReadonlyArray<ReadonlyArray<ReactNode>> => {
  const turns: Array<Array<ReactNode>> = [];
  nodes.forEach((node, index) => {
    const last = turns[turns.length - 1];
    if (last === undefined || starts.has(index)) {
      turns.push([node]);
      return;
    }
    last.push(node);
  });
  return turns;
};
