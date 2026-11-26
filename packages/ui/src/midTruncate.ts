export const MID_TRUNCATE_KEEP = 12;

type Params = {
  readonly name: string;
  readonly keep?: number;
};

export type MidTruncated = {
  readonly head: string;
  readonly tail: string;
};

export const midTruncate = ({ name, keep = MID_TRUNCATE_KEEP }: Params): MidTruncated => {
  if (name.length <= keep) {
    return { head: name, tail: '' };
  }
  return { head: name.slice(0, name.length - keep), tail: name.slice(name.length - keep) };
};
