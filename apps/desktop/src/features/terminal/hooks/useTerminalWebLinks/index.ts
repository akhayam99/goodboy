import { useCallback, useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { useRestHover } from '@goodboy/ui';
import type {
  TerminalWebLinkHover,
  TerminalWebLinkOpen,
} from '../../../../shared/components/GenericTerminalPanel/registerWebLinks';
import type { TerminalTab } from '../../../../shared/types/terminal';
import type { PeekTarget } from '../../../browser/WebLinkPeek';
import { openWebLink } from '../../../browser/openWebLink';

type Params = {
  readonly tab: TerminalTab;
  readonly sessionId: SessionId | null;
};

type TerminalWebLinks = {
  readonly onOpenWebLink: (link: TerminalWebLinkOpen) => void;
  readonly onWebLinkHover: (hover: TerminalWebLinkHover | null) => void;
  readonly peek: PeekTarget | null;
};

export const useTerminalWebLinks = ({ tab, sessionId }: Params): TerminalWebLinks => {
  const ownerSessionId = tab.owner.kind === 'session' ? tab.owner.sessionId : null;
  const placeSessionId = sessionId ?? ownerSessionId;
  const { target, enter, leave, close } = useRestHover<TerminalWebLinkHover>({
    hasWarmWindow: true,
  });

  const onOpenWebLink = useCallback(
    ({ url, event }: TerminalWebLinkOpen): void => {
      close();
      void openWebLink({ sessionId: placeSessionId, url, event });
    },
    [close, placeSessionId],
  );

  const onWebLinkHover = useCallback(
    (hover: TerminalWebLinkHover | null): void => {
      if (hover === null) {
        leave();
        return;
      }
      enter(hover);
    },
    [enter, leave],
  );

  const peek = useMemo(
    (): PeekTarget | null =>
      target === null
        ? null
        : {
            url: target.url,
            sessionId: placeSessionId,
            anchorOf: () => target.rect,
            roomOf: () => null,
          },
    [target, placeSessionId],
  );

  return { onOpenWebLink, onWebLinkHover, peek };
};
