const FORMAT = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' });

export const formatDate = (date: string) => FORMAT.format(new Date(`${date}T00:00:00Z`));
