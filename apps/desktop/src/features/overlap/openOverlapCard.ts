type RequestParams = {
  readonly mountId: string;
};

type SubscribeParams = {
  readonly listener: () => void;
};

const listeners = new Set<() => void>();
let counts: ReadonlyMap<string, number> = new Map();

export const requestOverlapCard = ({ mountId }: RequestParams): void => {
  counts = new Map([...counts, [mountId, (counts.get(mountId) ?? 0) + 1]]);
  for (const listener of [...listeners]) {
    listener();
  }
};

export const subscribeOverlapCard = ({ listener }: SubscribeParams): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const overlapCardRequestsOf = ({ mountId }: RequestParams): number =>
  counts.get(mountId) ?? 0;
