import type { BrowserTab } from '../../../../store/slices/browser/types';
import { hostOf } from '../../hostOf';
import { BrowserFavicon } from './BrowserFavicon';

type Props = {
  readonly tab: BrowserTab;
  readonly title: string;
};

const LINES = ['w-11/12', 'w-9/12', 'w-10/12', 'w-7/12'];

export const BrowserViewStandIn = ({ tab, title }: Props) => (
  <div data-browser-stand-in="" aria-hidden className="flex min-h-0 flex-1 flex-col bg-background">
    <div className="flex h-10 shrink-0 items-center gap-2 bg-subtle px-4">
      <BrowserFavicon url={tab.url} />
      <span className="truncate text-row-strong text-foreground">{hostOf({ url: tab.url })}</span>
    </div>
    <div className="flex flex-col gap-3 p-5">
      <span className="text-title text-foreground">{title}</span>
      <div className="flex flex-col gap-2 rounded-lg bg-subtle p-4">
        {LINES.map((width) => (
          <span key={width} className={`h-2 rounded-full bg-muted ${width}`} />
        ))}
      </div>
    </div>
  </div>
);
