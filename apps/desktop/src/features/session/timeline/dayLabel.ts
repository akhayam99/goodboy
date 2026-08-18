type Params = {
  readonly at: string;
  readonly now?: Date;
};

export const dayLabel = ({ at, now = new Date() }: Params): string | null => {
  const date = new Date(at);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === now.toDateString()) {
    return null;
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(date);
};
