export const ICON_SIZE = {
  mark: 10,
  row: 12,
  control: 14,
  notice: 16,
  hero: 18,
} as const;

export const ICON_STROKE = {
  mark: 2,
  row: 2,
  control: 1.75,
  notice: 1.75,
  hero: 1.5,
  check: 2.5,
} as const;

type IconStrokeParams = {
  readonly size: number;
};

export const iconStrokeOf = ({ size }: IconStrokeParams): number => {
  if (size <= ICON_SIZE.row) {
    return ICON_STROKE.row;
  }
  if (size <= ICON_SIZE.notice) {
    return ICON_STROKE.control;
  }
  return ICON_STROKE.hero;
};
