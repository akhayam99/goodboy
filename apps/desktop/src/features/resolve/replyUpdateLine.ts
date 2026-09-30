type Params = {
  readonly from: string;
  readonly to: string;
  readonly isFolded: boolean;
};

export const replyUpdateLine = ({ from, to, isFolded }: Params): string =>
  isFolded ? `Update: ${from} was squashed into ${to}.` : `Update: ${from} is now ${to}.`;
