import type { MutableRefObject } from 'react';
import type { Terminal } from '@xterm/xterm';
import { createFileLinkProvider, type TerminalFileLink } from './fileLinkProvider';

type Params = {
  readonly term: Terminal;
  readonly openRef: MutableRefObject<((link: TerminalFileLink) => void) | undefined>;
};

export const registerFileLinks = ({ term, openRef }: Params): void => {
  if (openRef.current === undefined) {
    return;
  }
  term.registerLinkProvider(
    createFileLinkProvider({
      lineAt: ({ index }) => term.buffer.active.getLine(index)?.translateToString(true),
      onOpen: ({ path, line, column }) => openRef.current?.({ path, line, column }),
    }),
  );
};
