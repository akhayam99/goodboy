import type { MouseEvent } from 'react';
import { SquareArrowOutUpRight } from 'lucide-react';
import { openUrl } from '../../lib/editor';
import { CopyButton, ICON_SIZE, Tooltip } from '@goodboy/ui';

type Props = {
  readonly url: string;
  readonly label: string;
  readonly hostLabel: string;
};

export const ExternalRefActions = ({ url, label, hostLabel }: Props) => {
  const onOpen = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    void openUrl(url);
  };

  return (
    <span className="inline-flex shrink-0 items-center gap-0.5">
      <Tooltip content={`Open in ${hostLabel}`}>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          onClick={onOpen}
          aria-label={`Open in ${hostLabel}`}
          className="inline-flex shrink-0 items-center rounded-md p-1 text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
        >
          <SquareArrowOutUpRight size={ICON_SIZE.row} aria-hidden />
        </a>
      </Tooltip>
      <CopyButton
        presentation="icon"
        value={url}
        label={`Copy ${label} link`}
        size={ICON_SIZE.row}
      />
    </span>
  );
};
