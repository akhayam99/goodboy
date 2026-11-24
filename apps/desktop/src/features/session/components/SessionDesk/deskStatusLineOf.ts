import { NAMES } from '../../../../shared/utils/names';

type Params = {
  readonly needsYou: number;
  readonly now: number;
  readonly next: number;
};

export const deskStatusLineOf = ({ needsYou, now, next }: Params): string => {
  const parts = [
    { label: NAMES.needsYou, count: needsYou },
    { label: NAMES.nowSection, count: now },
    { label: NAMES.nextSection, count: next },
  ]
    .filter(({ count }) => count > 0)
    .map(({ label, count }) => `${label} ${count}`);
  if (parts.length > 0) {
    return parts.join(' · ');
  }
  return NAMES.overview;
};
