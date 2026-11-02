type Params = {
  readonly text: string;
  readonly max?: number;
};

export const oneLine = ({ text, max }: Params): string => {
  const flat = text.replace(/\s+/g, ' ').trim();
  return max !== undefined && flat.length > max ? `${flat.slice(0, max)}...` : flat;
};
