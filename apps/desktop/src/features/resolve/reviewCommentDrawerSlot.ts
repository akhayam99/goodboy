type HostParams = {
  readonly host: HTMLElement | null;
};

let current: HTMLElement | null = null;
const listeners = new Set<() => void>();

const publish = (next: HTMLElement | null): void => {
  if (current === next) {
    return;
  }
  current = next;
  for (const listener of listeners) {
    listener();
  }
};

export const reviewCommentDrawerSlot = {
  get: (): HTMLElement | null => current,
  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  attach: ({ host }: HostParams): void => publish(host),
  detach: ({ host }: HostParams): void => {
    if (current !== host) {
      return;
    }
    publish(null);
  },
};
