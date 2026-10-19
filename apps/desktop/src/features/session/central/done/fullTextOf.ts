type Params = {
  readonly text: string | null | undefined;
  readonly title: string;
};

export const fullTextOf = ({ text, title }: Params): string | null => {
  const trimmed = (text ?? '').trim();
  if (trimmed === '' || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return null;
  }
  return trimmed === title ? null : trimmed;
};
