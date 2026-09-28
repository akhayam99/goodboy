type CompareParams = {
  readonly left: string;
  readonly right: string;
};

export const compareVersions = ({ left, right }: CompareParams) => {
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);
  const index = leftParts.findIndex((part, position) => part !== rightParts[position]);
  return index === -1 ? 0 : rightParts[index] - leftParts[index];
};
