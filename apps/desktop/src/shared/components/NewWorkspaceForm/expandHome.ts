type Params = {
  readonly text: string;
  readonly home: string | null;
};

export const expandHome = ({ text, home }: Params): string => {
  const trimmed = text.trim();
  if (home === null || (trimmed !== '~' && !trimmed.startsWith('~/'))) {
    return trimmed;
  }
  return `${home}${trimmed.slice(1)}`;
};
