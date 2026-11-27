import { runIdentitySeed, runIdentityStroke } from './runIdentity';

type Params = {
  readonly sourceId: string;
  readonly calendarId: string;
};

export const calendarIdentity = ({ sourceId, calendarId }: Params): string =>
  runIdentityStroke({ index: runIdentitySeed({ sessionId: `${sourceId}\u0000${calendarId}` }) });
