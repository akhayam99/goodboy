type Params = {
  readonly isWork: boolean;
  readonly turn: number | null;
};

export const noteWordOf = ({ isWork, turn }: Params): string => {
  if (!isWork) {
    return 'Queued';
  }
  return turn === null ? 'Not read yet' : `Read at turn ${turn}`;
};
