import { Clock } from 'lucide-react';
import { formatAbsoluteDateTime, formatRelativeAge } from '../utils/relativeDate';
import type { Fact } from './factTypes';

type Params = {
  readonly label: string;
  readonly iso: string | null;
};

export const timeFact = ({ label, iso }: Params): Fact | null => {
  if (iso == null || iso === '' || Number.isNaN(Date.parse(iso))) {
    return null;
  }
  return {
    key: 'time',
    label,
    icon: Clock,
    hint: `${label} ${formatAbsoluteDateTime({ iso })}`,
    node: <time dateTime={iso}>{formatRelativeAge({ fromIso: iso })}</time>,
  };
};
