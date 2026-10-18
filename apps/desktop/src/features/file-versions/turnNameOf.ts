import type { ChangeTurn } from './changeTurnsOf';

type Params = Readonly<{
  turn: Pick<ChangeTurn, 'number' | 'title'>;
}>;

export const turnNameOf = ({ turn }: Params): string =>
  turn.title === null ? `Turn ${turn.number}` : `Turn ${turn.number} · ${turn.title}`;
