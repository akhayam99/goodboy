type Params = {
  readonly combo: string;
};

export const offMacOf = ({ combo }: Params): string =>
  combo
    .split('+')
    .map((part) => (part === 'cmd' ? 'ctrl' : part))
    .join('+');
