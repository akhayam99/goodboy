import { formatDate } from '../../../../shared/utils/time/formatDate';
import { formatDayMonth } from '../../../../shared/utils/time/formatDayMonth';

export const dayKey = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return 'unknown';
  }
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

export const formatDayLabel = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  if (d.getFullYear() === new Date().getFullYear()) {
    return formatDayMonth({ at: iso });
  }
  return formatDate({ at: iso });
};
