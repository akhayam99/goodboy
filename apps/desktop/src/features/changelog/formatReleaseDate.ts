type Params = {
  readonly iso: string;
  readonly style: 'short' | 'full';
};

export const formatReleaseDate = ({ iso, style }: Params): string => {
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) {
    return '';
  }
  const options: Intl.DateTimeFormatOptions =
    style === 'short'
      ? { day: 'numeric', month: 'short' }
      : { day: 'numeric', month: 'long', year: 'numeric' };
  return new Intl.DateTimeFormat(undefined, options).format(timestamp);
};
