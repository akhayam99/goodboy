import { Chip, Tooltip } from '@goodboy/ui';
import { useAppStore } from '../../../store';
import { openUrl } from '../../../shared/lib/editor';

type Props = {
  readonly port: number;
};

export const PortChip = ({ port }: Props) => {
  const reportError = useAppStore((s) => s.reportError);
  const url = `http://localhost:${port}`;
  return (
    <Tooltip content={`Open localhost:${port}`}>
      <Chip
        tone="neutral"
        kind="reference"
        label={`:${port}`}
        ariaLabel={`Open localhost:${port}`}
        onClick={() => {
          openUrl(url).catch((error: unknown) =>
            reportError({ title: `Couldn't open localhost:${port}`, error }),
          );
        }}
      />
    </Tooltip>
  );
};
