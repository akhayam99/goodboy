type Params = {
  readonly time: string;
};

export const ageTokenOf = ({ time }: Params): string => time.replaceAll(' ', ' ');
