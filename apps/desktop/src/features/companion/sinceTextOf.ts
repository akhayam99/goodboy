import { dayLabelOf } from '../../shared/utils/time/dayLabelOf';
import { formatClock } from '../../shared/utils/time/formatClock';

type Params = {
  readonly at: string;
  readonly now: number;
};

export const sinceTextOf = ({ at, now }: Params): string => {
  const day = dayLabelOf({ at, now, casing: 'inline' });
  if (day === '') {
    return '';
  }
  const clock = formatClock({ at });
  return day === 'today' ? clock : `${day}, ${clock}`;
};
