import { APP_LOCALE } from './format';

export const formatRelativeDuration = (fromIso: string, toIso?: string): string => {
  const fromMs = Date.parse(fromIso);
  if (Number.isNaN(fromMs)) {
    return '';
  }
  const toMs = toIso ? Date.parse(toIso) : Date.now();
  if (Number.isNaN(toMs)) {
    return '';
  }
  const diff = Math.max(0, Math.floor((toMs - fromMs) / 1000));
  if (diff < 60) {
    return `${diff}s`;
  }
  const m = Math.floor(diff / 60);
  if (m < 60) {
    return `${m}m`;
  }
  const h = Math.floor(m / 60);
  if (h < 24) {
    return `${h}h`;
  }
  const d = Math.floor(h / 24);
  return `${d}d`;
};

type AbsoluteDateTimeParams = {
  readonly iso: string;
  readonly locale?: Intl.LocalesArgument;
};

export const formatAbsoluteDateTime = ({
  iso,
  locale = APP_LOCALE,
}: AbsoluteDateTimeParams): string => {
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) {
    return '';
  }
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(timestamp);
};

type FormatRelativeAgeParams = {
  readonly fromIso: string;
  readonly nowMs?: number;
};

export const formatRelativeAge = ({ fromIso, nowMs }: FormatRelativeAgeParams): string => {
  const fromMs = Date.parse(fromIso);
  if (Number.isNaN(fromMs)) {
    return '';
  }
  const toMs = nowMs ?? Date.now();
  const seconds = Math.max(0, Math.floor((toMs - fromMs) / 1000));
  if (seconds < 60) {
    return 'just now';
  }
  return `${formatRelativeDuration(fromIso, new Date(toMs).toISOString())} ago`;
};
