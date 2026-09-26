import type { ReactNode } from 'react';
import { formatAbsoluteDateTime, formatRelativeAge } from '../utils/relativeDate';

type TimeParams = {
  readonly iso: string | null;
};

export const relativeTimeNode = ({ iso }: TimeParams): ReactNode | null => {
  if (iso == null || iso === '' || Number.isNaN(Date.parse(iso))) {
    return null;
  }
  return (
    <time dateTime={iso} title={formatAbsoluteDateTime({ iso })}>
      {formatRelativeAge({ fromIso: iso })}
    </time>
  );
};

type BylineParams = {
  readonly lead?: string | null;
  readonly verb?: string;
  readonly iso: string | null;
};

export const recordByline = ({ lead = null, verb, iso }: BylineParams): ReactNode | null => {
  const time = relativeTimeNode({ iso });
  if (lead == null) {
    return time;
  }
  if (time == null) {
    return lead;
  }
  return (
    <>
      {lead} · {verb == null ? null : `${verb} `}
      {time}
    </>
  );
};
