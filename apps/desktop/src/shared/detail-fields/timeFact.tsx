import { Clock } from 'lucide-react';
import { formatDateTime } from '../utils/time/formatDateTime';
import type { Fact } from './factTypes';
import { RelativeTime } from '../components/RelativeTime';

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
    hint: `${label} ${formatDateTime({ at: iso, hasYear: true })}`,
    node: <RelativeTime iso={iso} />,
  };
};
