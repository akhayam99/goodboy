type Params = {
  readonly mountPaths: ReadonlyArray<string>;
  readonly placePath: string | null;
  readonly remembered: string | null;
  readonly activePath: string | null;
};

export const sessionTerminalCwd = ({
  mountPaths,
  placePath,
  remembered,
  activePath,
}: Params): string | null => {
  const [first] = mountPaths;
  if (first === undefined) {
    return activePath;
  }
  if (mountPaths.length === 1) {
    return first;
  }
  if (placePath !== null && mountPaths.includes(placePath)) {
    return placePath;
  }
  if (remembered !== null && mountPaths.includes(remembered)) {
    return remembered;
  }
  if (activePath !== null && mountPaths.includes(activePath)) {
    return activePath;
  }
  return first;
};
