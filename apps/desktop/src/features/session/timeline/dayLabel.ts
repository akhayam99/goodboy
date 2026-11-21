import { dayLabelOf } from '../../../shared/utils/time/dayLabelOf';

type Params = {
  readonly at: string;
  readonly now?: Date;
};

export const dayLabel = ({ at, now = new Date() }: Params): string | null => {
  const date = new Date(at);
  if (date.toDateString() === now.toDateString()) {
    return null;
  }
  return dayLabelOf({ at, now: now.getTime() });
};
