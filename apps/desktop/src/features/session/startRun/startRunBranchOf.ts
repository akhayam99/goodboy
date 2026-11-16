type Params = {
  readonly event: Event;
};

export const startRunBranchOf = ({ event }: Params): string | null => {
  if (!(event instanceof CustomEvent)) {
    return null;
  }
  const detail: unknown = event.detail;
  if (typeof detail !== 'object' || detail === null || !('branch' in detail)) {
    return null;
  }
  const { branch } = detail;
  return typeof branch === 'string' && branch !== '' ? branch : null;
};
