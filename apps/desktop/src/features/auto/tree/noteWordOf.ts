type Params = {
  readonly turn: number | null;
};

export const noteWordOf = ({ turn }: Params): string =>
  turn === null ? 'Not read yet' : `Read at turn ${turn}`;
