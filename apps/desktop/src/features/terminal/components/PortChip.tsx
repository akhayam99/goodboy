import type { SessionId } from '@goodboy/types';
import { Chip, Tooltip } from '@goodboy/ui';
import { isOwnBrowserClick } from '../../browser/isOwnBrowserClick';
import { openInBrowser } from '../../browser/openInBrowser';
import { openInYourBrowser } from '../../browser/openInYourBrowser';
import { ownBrowserClickWord } from '../../browser/ownBrowserClickWord';

type Props = {
  readonly port: number;
  readonly sessionId: SessionId | null;
};

export const PortChip = ({ port, sessionId }: Props) => {
  const url = `http://localhost:${port}`;
  const tooltip =
    sessionId === null
      ? `Open localhost:${port} in your browser`
      : `Open localhost:${port} beside the session. ${ownBrowserClickWord()} opens your browser`;
  return (
    <Tooltip content={tooltip}>
      <Chip
        tone="neutral"
        kind="reference"
        label={`:${port}`}
        ariaLabel={`Open localhost:${port}`}
        onClick={(event) => {
          if (isOwnBrowserClick({ event })) {
            void openInYourBrowser({ url });
            return;
          }
          void openInBrowser({ sessionId, url });
        }}
      />
    </Tooltip>
  );
};
