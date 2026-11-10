type Params = {
  readonly previousTitle: string;
};

export const unlockHintOf = ({ previousTitle }: Params): string => `Finish ${previousTitle} first.`;
