type Params = {
  readonly from: number;
  readonly at: number;
};

export const dropTarget = ({ from, at }: Params): number => (at > from ? at - 1 : at);
