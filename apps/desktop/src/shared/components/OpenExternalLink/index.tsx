import type { MouseEvent } from 'react';
import { ExternalLink } from 'lucide-react';
import { openUrl } from '../../lib/editor';
import { CopyLinkButton } from '../CopyLinkButton';

type Props = {
  readonly url: string;
  readonly label: string;
  readonly copyLabel?: string;
};

export const OpenExternalLink = ({ url, label, copyLabel }: Props) => {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    void openUrl(url);
  };

  const link = (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-2xs text-muted-foreground transition-colors hover:text-foreground"
    >
      {label} <ExternalLink size={11} aria-hidden />
    </a>
  );

  if (!copyLabel) return link;

  return (
    <span className="inline-flex items-center gap-0.5">
      {link}
      <CopyLinkButton url={url} label={copyLabel} />
    </span>
  );
};
