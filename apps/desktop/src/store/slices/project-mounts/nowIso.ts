import type { IsoDateTime } from '@goodboy/types';

type NowIsoParams = {
  readonly at?: Date;
};

type ParseIsoDateTimeParams = {
  readonly value: string;
};

const parseIsoDateTime = ({ value }: ParseIsoDateTimeParams): IsoDateTime | undefined => {
  if (Number.isNaN(Date.parse(value))) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(value));
};

export const nowIso = ({ at = new Date() }: NowIsoParams): IsoDateTime => {
  const stamp = parseIsoDateTime({ value: at.toISOString() });
  if (stamp === undefined) {
    throw new Error('the clock returned an invalid date');
  }
  return stamp;
};
