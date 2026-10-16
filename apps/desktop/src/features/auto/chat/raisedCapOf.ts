const STEPS: ReadonlyArray<number> = [5, 10, 20];

type Params = {
  readonly capUsd: number;
};

export const raisedCapOf = ({ capUsd }: Params): number =>
  STEPS.find((step) => step > capUsd + 1e-9) ?? capUsd * 2;
