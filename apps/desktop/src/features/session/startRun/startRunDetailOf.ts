type Params = {
  readonly event: Event;
};

const isTextDetail = (value: unknown): value is Readonly<{ text: string }> =>
  typeof value === 'object' && value !== null && 'text' in value && typeof value.text === 'string';

export const startRunDetailOf = ({ event }: Params): string => {
  if (!(event instanceof CustomEvent)) {
    return '';
  }
  const detail: unknown = event.detail;
  return isTextDetail(detail) ? detail.text : '';
};
