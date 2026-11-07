type Params = {
  readonly process: {
    readonly pid: number;
    readonly birthId?: string | null;
    readonly argsMasked: string;
  } | null;
  readonly rest: string;
};

export const processFoldKey = ({ process, rest }: Params): string => {
  if (process === null) {
    return `proc:-:-:${rest}`;
  }
  if (process.birthId === undefined || process.birthId === null) {
    return `proc:${process.pid}:-:${encodeURIComponent(process.argsMasked)}:${rest}`;
  }
  return `proc:${process.pid}:${process.birthId}:${rest}`;
};
