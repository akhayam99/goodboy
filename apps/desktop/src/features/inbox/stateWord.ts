type Params = { readonly value: string | null };

const ALIASES: Readonly<Record<string, string>> = {
  opened: 'Open',
};

export const stateWord = ({ value }: Params): string => {
  const trimmed = (value ?? '').trim();
  if (trimmed === '') {
    return 'Open';
  }
  const alias = ALIASES[trimmed.toLowerCase()];
  if (alias !== undefined) {
    return alias;
  }
  const spaced = trimmed.replace(/[_-]+/g, ' ').toLowerCase();
  return `${spaced.charAt(0).toUpperCase()}${spaced.slice(1)}`;
};
