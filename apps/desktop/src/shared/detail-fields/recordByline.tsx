import type { ReactNode } from 'react';
import { formatDateTime } from '../utils/time/formatDateTime';
import { RelativeTime } from '../components/RelativeTime';

type TimeParams = {
  readonly iso: string | null;
};

export const relativeTimeNode = ({ iso }: TimeParams): ReactNode | null => {
  if (iso == null || iso === '' || Number.isNaN(Date.parse(iso))) {
    return null;
  }
  return <RelativeTime iso={iso} title={formatDateTime({ at: iso, hasYear: true })} />;
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
