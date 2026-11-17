import type { BoardRow } from './boardTypes';

type Params = {
  readonly rows: ReadonlyArray<BoardRow>;
};

export const boardProjectNamesOf = ({ rows }: Params): ReadonlyArray<string> => [
  ...new Set(rows.flatMap((row) => (row.projectName === null ? [] : [row.projectName]))),
];
