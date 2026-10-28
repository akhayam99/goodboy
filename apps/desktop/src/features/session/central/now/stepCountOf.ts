type Params = {
  readonly started: number;
  readonly total: number;
};

export const stepCountOf = ({ started, total }: Params): string =>
  `${Math.min(started, total)}/${total}`;
