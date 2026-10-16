import { formatInteger } from './formatInteger';

type Params = {
  readonly count: number | null;
  readonly isBesideGlyph?: boolean;
};

export const countSlotText = ({ count, isBesideGlyph = false }: Params): string | null => {
  if (count === null || !Number.isFinite(count)) {
    return null;
  }
  const floor = isBesideGlyph ? 2 : 1;
  if (count < floor) {
    return null;
  }
  return formatInteger(Math.floor(count));
};
