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
  const glyphs = Array.from(name);
  if (glyphs.length <= keep) {
    return { head: name, tail: '' };
  }
  return {
    head: glyphs.slice(0, glyphs.length - keep).join(''),
    tail: glyphs.slice(glyphs.length - keep).join(''),
  };
};
