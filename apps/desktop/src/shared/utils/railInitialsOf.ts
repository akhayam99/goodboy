type Params = { readonly title: string };

export const railInitialsOf = ({ title }: Params): string => {
  const words = title
    .trim()
    .split(/\s+/)
    .filter((word) => word !== '');
  if (words.length === 0) {
    return '?';
  }
  const first = words[0] ?? '';
  if (words.length === 1) {
    return Array.from(first).slice(0, 2).join('').toUpperCase();
  }
  return `${Array.from(first)[0] ?? ''}${Array.from(words[1] ?? '')[0] ?? ''}`.toUpperCase();
};
