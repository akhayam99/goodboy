import type { IconWeight } from '@phosphor-icons/react/dist/lib/types';

export const ICON_SIZE = {
  mark: 10,
  row: 12,
  control: 14,
  notice: 16,
  hero: 18,
} as const;

export const ICON_WEIGHT = {
  mark: 'bold',
  row: 'bold',
  control: 'regular',
  notice: 'regular',
  hero: 'regular',
  check: 'bold',
} as const satisfies Record<string, IconWeight>;

type IconWeightParams = {
  readonly size: number;
};

export const iconWeightOf = ({ size }: IconWeightParams): IconWeight => {
  if (size <= ICON_SIZE.row) {
    return ICON_WEIGHT.row;
  }
  if (size <= ICON_SIZE.notice) {
    return ICON_WEIGHT.control;
  }
  return ICON_WEIGHT.hero;
};
