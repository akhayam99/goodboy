type Params = {
  readonly text: string;
};

export const startSentence = ({ text }: Params): string =>
  text.length === 0 ? text : `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
