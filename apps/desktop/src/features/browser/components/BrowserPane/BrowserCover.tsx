import type { BrowserTab } from '../../../../store/slices/browser/types';
import { coverReasonText } from '../../coverReasonText';
import type { CoverReason } from '../../createOverlayWatch';
import { hostOf } from '../../hostOf';
import { BrowserFavicon } from './BrowserFavicon';

type Props = {
  readonly tab: BrowserTab;
  readonly title: string;
  readonly reason: CoverReason;
};

export const BrowserCover = ({ tab, title, reason }: Props) => (
  <div
    data-browser-cover={reason}
    role="status"
    className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-subtle p-6 text-center"
  >
    <BrowserFavicon url={tab.url} />
    <span className="max-w-full truncate text-row text-foreground">
      {title === '' ? hostOf({ url: tab.url }) : title}
    </span>
    <span className="max-w-full truncate text-meta text-muted-foreground">
      {hostOf({ url: tab.url })}
    </span>
    <span className="text-meta text-faint-foreground">{coverReasonText({ reason })}</span>
  </div>
);
