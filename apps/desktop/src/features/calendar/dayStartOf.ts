type Params = {
  readonly at: number;
  readonly dayOffset?: number;
};

export const dayStartOf = ({ at, dayOffset = 0 }: Params): number => {
  const date = new Date(at);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + dayOffset).getTime();
};
