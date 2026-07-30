import type { MouseEvent } from 'react';
import { ExternalLink } from 'lucide-react';
import { openUrl } from '../../lib/editor';

type Props = {
  readonly url: string;
  readonly label: string;
};

export const OpenExternalLink = ({ url, label }: Props) => {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    void openUrl(url);
  };

  return (
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
};
