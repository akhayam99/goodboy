type Params = {
  readonly count: number;
};

export const systemNoteFootnote = ({ count }: Params): string | null => {
  if (count === 0) {
    return null;
  }
  return count === 1 ? '1 system event hidden' : `${count} system events hidden`;
};
