type Params = {
  readonly title: string;
};

export const unlockHintOf = ({ title }: Params): string =>
  `${title} unlocks when the group before it is done`;
