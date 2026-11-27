type Params = {
  readonly a: (() => void) | undefined;
  readonly b: (() => void) | undefined;
};

export const mergedDismissOf = ({ a, b }: Params): (() => void) | undefined => {
  if (a === undefined || b === undefined) {
    return a ?? b;
  }
  return () => {
    a();
    b();
  };
};
