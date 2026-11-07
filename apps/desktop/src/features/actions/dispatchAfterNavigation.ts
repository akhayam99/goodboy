type Params = {
  readonly name: string;
  readonly detail?: unknown;
};

const SETTLE_MS = 60;

export const dispatchAfterNavigation = ({ name, detail }: Params): void => {
  setTimeout(() => {
    const hasWindow = typeof window !== 'undefined';
    if (!hasWindow) {
      return;
    }
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }, SETTLE_MS);
};
