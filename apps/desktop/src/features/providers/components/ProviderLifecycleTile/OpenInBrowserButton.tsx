import { ExternalLink } from 'lucide-react';
import { openUrl } from '../../../../shared/lib/editor';

type Props = {
  readonly url: string;
};

export const OpenInBrowserButton = ({ url }: Props) => {
  return (
    <button
      type="button"
      onClick={() => void openUrl(url)}
      title={url}
      className="inline-flex items-center justify-center gap-1.5 rounded-md border border-primary/30 px-3 py-1.5 text-xs text-primary transition-colors hover:bg-primary/10"
    >
      <ExternalLink size={12} aria-hidden />
      <span>Open in browser</span>
    </button>
  );
};
