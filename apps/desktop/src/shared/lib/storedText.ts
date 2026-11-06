type KeyParams = Readonly<{
  key: string;
}>;

type WriteParams = KeyParams &
  Readonly<{
    text: string;
  }>;

export const storedText = {
  read: ({ key }: KeyParams): string => {
    try {
      return localStorage.getItem(key) ?? '';
    } catch {
      return '';
    }
  },
  write: ({ key, text }: WriteParams): void => {
    try {
      if (text === '') {
        localStorage.removeItem(key);
        return;
      }
      localStorage.setItem(key, text);
    } catch {
      return;
    }
  },
};
