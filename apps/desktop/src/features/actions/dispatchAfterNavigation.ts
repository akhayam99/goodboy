type Params = {
  readonly name: string;
  readonly detail?: unknown;
};

const SETTLE_MS = 60;

export const dispatchAfterNavigation = ({ name, detail }: Params): void => {
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }, SETTLE_MS);
};
