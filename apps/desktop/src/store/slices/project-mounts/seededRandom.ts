type Params = {
  readonly seed: string;
};

const FNV_OFFSET = 2166136261;
const FNV_PRIME = 16777619;

const hashSeed = ({ seed }: Params): number => {
  let hash = FNV_OFFSET;
  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), FNV_PRIME);
  }
  return hash >>> 0;
};

export const seededRandom = ({ seed }: Params): (() => number) => {
  let state = hashSeed({ seed });
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
};
