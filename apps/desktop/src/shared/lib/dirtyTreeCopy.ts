type Params = {
  readonly count: number;
};

const filesOf = ({ count }: Params): string => (count === 1 ? '1 file' : `${count} files`);

export const dirtyTreeSentence = ({ count }: Params): string =>
  `${filesOf({ count })} ${count === 1 ? 'has' : 'have'} changes that aren't committed. Commit or stash them first.`;
