type Params = {
  readonly text: string;
  readonly limit: number;
};

export const clip = ({ text, limit }: Params): string => {
  const collapsed = text.trim();
  return collapsed.length <= limit ? collapsed : `${collapsed.slice(0, limit)}...`;
};
