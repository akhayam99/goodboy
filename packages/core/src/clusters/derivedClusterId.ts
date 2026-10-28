type Params = Readonly<{
  index: number;
}>;

export const derivedClusterId = ({ index }: Params): string => `part-${index + 1}`;
