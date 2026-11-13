import type { SessionId } from '@goodboy/types';
import { Chip, Tooltip } from '@goodboy/ui';
import { openWebLink } from '../../browser/openWebLink';
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
        onClick={(event) => void openWebLink({ sessionId, url, event })}
      />
    </Tooltip>
  );
};
