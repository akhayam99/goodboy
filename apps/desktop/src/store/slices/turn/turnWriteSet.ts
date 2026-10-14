type Params = Readonly<{
  workingDir: string;
  writableRoots: ReadonlyArray<string>;
}>;

export const turnWriteSet = ({ workingDir, writableRoots }: Params): ReadonlyArray<string> =>
  Array.from(new Set([workingDir, ...writableRoots]));
