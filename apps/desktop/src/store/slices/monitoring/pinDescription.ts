export const PIN_DESCRIPTION_MAX = 60;

type Params = {
  readonly text: string;
};

export const normalizeDescription = ({ text }: Params): string =>
  text.trim().replace(/\s+/g, ' ').slice(0, PIN_DESCRIPTION_MAX).trim();
