import type { MutableRefObject } from 'react';
import type { Terminal } from '@xterm/xterm';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { requestOpenLink } from '../../lib/requestOpenLink';
import { webLinkHoverOf } from './webLinkHoverOf';
import { webLinkRectOf, type TerminalLinkRect } from './webLinkRectOf';

export type TerminalWebLinkOpen = {
  readonly url: string;
  readonly event: MouseEvent;
};

export type TerminalWebLinkHover = {
  readonly url: string;
  readonly rect: TerminalLinkRect;
};

type Params = {
  readonly term: Terminal;
  readonly openRef: MutableRefObject<((link: TerminalWebLinkOpen) => void) | undefined>;
  readonly hoverRef: MutableRefObject<((hover: TerminalWebLinkHover | null) => void) | undefined>;
};

export const registerWebLinks = ({ term, openRef, hoverRef }: Params): void => {
  term.loadAddon(
    new WebLinksAddon(
      (event, uri) => {
        const open = openRef.current;
        if (open === undefined) {
          requestOpenLink({ url: uri, event });
          return;
        }
        open({ url: uri, event });
      },
      {
        hover: webLinkHoverOf({
          onRest: ({ uri, location }) => {
            const rect = webLinkRectOf({ term, location });
            if (rect !== null) {
              hoverRef.current?.({ url: uri, rect });
            }
          },
        }),
        leave: () => hoverRef.current?.(null),
      },
    ),
  );
};
