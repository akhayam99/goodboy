type Params = {
  readonly title: string;
  readonly closeLabel: string | undefined;
};

export const closeLabelOf = ({ title, closeLabel }: Params): string =>
  closeLabel ?? `Close ${title.toLowerCase()}`;
