import type { ISearchOptions } from '@xterm/addon-search';
import { resolveTerminalFindColors } from './terminal-theme';

type Params = {
  readonly theme: 'dark' | 'light';
};

export const terminalFindOptions = ({ theme }: Params): ISearchOptions => ({
  caseSensitive: false,
  incremental: false,
  decorations: resolveTerminalFindColors({ theme }),
});
