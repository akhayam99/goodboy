import type { ConnectionState } from './connectionState';

type Params = {
  readonly sourceCount: number;
  readonly failedCount: number;
};

const BASE: Pick<ConnectionState, 'reason' | 'isChecking'> = {
  reason: null,
  isChecking: false,
};

export const calendarConnectionStateOf = ({
  sourceCount,
  failedCount,
}: Params): ConnectionState => {
  if (sourceCount === 0) {
    return { ...BASE, word: 'Not set up', tone: null, setupVerb: 'Connect' };
  }
  if (failedCount > 0) {
    return {
      ...BASE,
      word: "Can't read",
      tone: 'danger',
      reason: "A connected calendar couldn't be read.",
      setupVerb: null,
    };
  }
  return { ...BASE, word: 'Connected', tone: null, setupVerb: null };
};
