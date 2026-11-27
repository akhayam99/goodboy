type Params = {
  readonly tipId: string;
};

export const homeTipKey = ({ tipId }: Params): string => `home.tip.${tipId}`;
