type Params = {
  readonly label: string;
  readonly items: ReadonlyArray<string> | undefined;
};

export const composeClusterChecks = ({ label, items }: Params): string => {
  if (items === undefined || items.length === 0) {
    return '';
  }
  return [`**${label}**`, ...items.map((item) => `- ${item}`)].join('\n');
};
