type Pending = {
  readonly promise: Promise<void>;
  readonly release: () => void;
};

const createPending = (): Pending => {
  const release: { current: () => void } = { current: () => undefined };
  const promise = new Promise<void>((resolve) => {
    release.current = resolve;
  });
  return { promise, release: () => release.current() };
};

let pending: Pending | null = null;

export const schemaGate = {
  isOpen: (): boolean => pending === null,
  wait: async (): Promise<void> => {
    if (pending === null) {
      return;
    }
    await pending.promise;
  },
  open: (): void => {
    const current = pending;
    pending = null;
    current?.release();
  },
  close: (): void => {
    if (pending !== null) {
      return;
    }
    pending = createPending();
  },
};
