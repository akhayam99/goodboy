import type { MouseEvent } from 'react';
import { ExternalLink } from 'lucide-react';
import { openUrl } from '../../lib/editor';
import { CopyButton, Tooltip } from '@goodboy/ui';
import { ICON_SIZE } from '../conceptIcons';

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
          <ExternalLink size={ICON_SIZE.row} aria-hidden />
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
