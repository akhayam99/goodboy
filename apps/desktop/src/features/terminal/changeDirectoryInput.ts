type Params = {
  readonly path: string;
};

const END_OF_LINE = '\x05';

const KILL_LINE = '\x15';

const quoted = ({ path }: Params): string => `'${path.split("'").join("'\\''")}'`;

export const changeDirectoryInput = ({ path }: Params): string =>
  `${END_OF_LINE}${KILL_LINE}cd ${quoted({ path })}\r`;
