type Params = {
  readonly text: string;
};

export const sentenceCase = ({ text }: Params): string =>
  text === '' ? '' : `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
