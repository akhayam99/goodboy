type Params = {
  readonly iso: string | number;
};

export const toValidDate = ({ iso }: Params): Date | null => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
};
