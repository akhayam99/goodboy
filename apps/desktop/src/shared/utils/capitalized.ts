type Params = {
  readonly text: string;
};

export const capitalized = ({ text }: Params): string =>
  `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
