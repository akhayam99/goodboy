type Params = {
  readonly process: { readonly pid: number; readonly startedAt: number } | null;
  readonly rest: string;
};

export const processFoldKey = ({ process, rest }: Params): string =>
  process === null ? `proc:-:-:${rest}` : `proc:${process.pid}:${process.startedAt}:${rest}`;
