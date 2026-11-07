import type { ChangeTurn } from './changeTurnsOf';

type Params = Readonly<{
  turn: Pick<ChangeTurn, 'number' | 'title'>;
}>;

export const turnNameOf = ({ turn }: Params): string =>
  turn.title === null ? `Reply ${turn.number}` : `Reply ${turn.number} · ${turn.title}`;
