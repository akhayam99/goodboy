import type { ISearchOptions } from '@xterm/addon-search';

const DECORATIONS: Readonly<Record<'dark' | 'light', NonNullable<ISearchOptions['decorations']>>> =
  {
    dark: {
      matchBackground: '#f0c67440',
      matchOverviewRuler: '#f0c674',
      activeMatchBackground: '#f0c674a0',
      activeMatchColorOverviewRuler: '#ffd88a',
    },
    light: {
      matchBackground: '#fde68a90',
      matchOverviewRuler: '#c18401',
      activeMatchBackground: '#f59e0bc0',
      activeMatchColorOverviewRuler: '#986801',
    },
  };

type Params = {
  readonly theme: 'dark' | 'light';
};

export const terminalFindOptions = ({ theme }: Params): ISearchOptions => ({
  caseSensitive: false,
  incremental: false,
  decorations: DECORATIONS[theme],
});
