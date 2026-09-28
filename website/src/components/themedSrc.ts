import type { Theme } from '../theme/theme';

type ThemedParams = {
  readonly id: string;
  readonly theme: Theme;
};

export const themedId = ({ id, theme }: ThemedParams): string =>
  theme === 'light' ? `${id}-light` : id;
