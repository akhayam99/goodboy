import { formatShortDate, formatWeekday } from '../../../../shared/utils/format';

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
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (diffDays === 0) {
    return 'today';
  }
  if (diffDays === 1) {
    return 'yesterday';
  }
  if (diffDays > 0 && diffDays < 7) {
    return formatWeekday({ iso }).toLowerCase();
  }
  return formatShortDate({ iso }).toLowerCase();
};
