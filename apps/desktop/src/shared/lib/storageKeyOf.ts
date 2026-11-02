type Params = {
  readonly prefix: string;
  readonly id: string;
};

export const storageKeyOf = ({ prefix, id }: Params): string => `${prefix}${id}`;
