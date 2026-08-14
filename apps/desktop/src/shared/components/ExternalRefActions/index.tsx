import type { MouseEvent } from 'react';
import { ExternalLink } from 'lucide-react';
import { openUrl } from '../../lib/editor';
import { CopyButton } from '@goodboy/ui';

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
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        onClick={onOpen}
        title={`Open in ${hostLabel}`}
        aria-label={`Open in ${hostLabel}`}
        className="inline-flex shrink-0 items-center rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
      >
        <ExternalLink size={13} aria-hidden />
      </a>
      <CopyButton presentation="icon" value={url} label={`Copy ${label} link`} size={13} />
    </span>
  );
};
