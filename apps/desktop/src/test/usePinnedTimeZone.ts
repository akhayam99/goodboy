import { afterAll, beforeAll } from 'vitest';

type Params = {
  readonly timeZone: string;
};

export const usePinnedTimeZone = ({ timeZone }: Params): void => {
  let previous: string | undefined;
  beforeAll(() => {
    previous = process.env['TZ'];
    process.env['TZ'] = timeZone;
  });
  afterAll(() => {
    if (previous === undefined) {
      delete process.env['TZ'];
      return;
    }
    process.env['TZ'] = previous;
  });
};
