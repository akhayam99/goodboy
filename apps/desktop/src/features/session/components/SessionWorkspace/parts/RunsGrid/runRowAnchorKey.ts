type Params = {
  readonly rowKey: string;
};

export const runRowAnchorKey = ({ rowKey }: Params): string => `run:${rowKey}`;
