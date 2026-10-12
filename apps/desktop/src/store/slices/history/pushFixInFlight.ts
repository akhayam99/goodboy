type KeyParams = { readonly key: string };

const claimed = new Set<string>();

export const pushFixInFlight = {
  claim: ({ key }: KeyParams): boolean => {
    if (claimed.has(key)) {
      return false;
    }
    claimed.add(key);
    return true;
  },
  release: ({ key }: KeyParams): void => {
    claimed.delete(key);
  },
};
