type Params = {
  readonly text: string;
};

const SAFE = /^[\w@%+=:,./-]+$/;

export const shellQuote = ({ text }: Params): string => {
  const clean = text.replace(/[\u0000-\u001F\u007F]/g, ' ').trim();
  if (clean !== '' && SAFE.test(clean)) {
    return clean;
  }
  return `'${clean.replace(/'/g, `'\\''`)}'`;
};
