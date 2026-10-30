type Params = {
  readonly doneFlags: ReadonlyArray<boolean>;
};

export const questionsLeft = ({ doneFlags }: Params): number =>
  doneFlags.filter((isDone) => !isDone).length;
