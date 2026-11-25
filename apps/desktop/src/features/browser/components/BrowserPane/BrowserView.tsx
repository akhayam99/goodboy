import type { RefObject } from 'react';
import { Button, EmptyState } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { MOCK_ENABLED } from '../../../../shared/lib/mockMode';
import type { DevicePresetId } from '../../../../store/slices/browser/types';
import type { ShownTab } from '../../types';
import type { CoverReason } from '../../createOverlayWatch';
import { devicePresetOf } from '../../devicePresets';
import { BrowserCover } from './BrowserCover';
import { BrowserDeviceFrame } from './BrowserDeviceFrame';
import { BrowserParkedTab } from './BrowserParkedTab';
import { BrowserViewStandIn } from './BrowserViewStandIn';

type Props = {
  readonly frame: RefObject<HTMLDivElement | null>;
  readonly view: RefObject<HTMLDivElement | null>;
  readonly shown: ShownTab | null;
  readonly title: string;
  readonly cover: CoverReason | null;
  readonly devicePreset?: DevicePresetId;
  readonly onNew?: () => void;
  readonly onWake?: () => void;
};

export const BrowserView = ({
  frame,
  view,
  shown,
  title,
  cover,
  devicePreset = 'desktop',
  onNew,
  onWake,
}: Props) => {
  const width = devicePresetOf({ id: devicePreset }).width;
  const parked =
    shown !== null && onWake !== undefined ? (
      <BrowserParkedTab tab={shown.tab} onWake={onWake} />
    ) : null;
  const page =
    shown === null || parked !== null ? null : (
      <div
        ref={view}
        data-browser-view={shown.tab.id}
        aria-label={`Page: ${title}`}
        role="region"
        className="relative flex min-h-0 flex-1 flex-col"
      >
        {MOCK_ENABLED ? <BrowserViewStandIn tab={shown.tab} title={title} /> : null}
        {cover === null ? null : <BrowserCover tab={shown.tab} title={title} reason={cover} />}
      </div>
    );
  return (
    <div
      ref={frame}
      data-browser-frame=""
      className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-t border-border-soft bg-background"
    >
      {parked}
      {page === null && parked === null ? (
        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
          <EmptyState
            icon={CONCEPT_ICONS.browser}
            title="No page open"
            description="Type an address, or open a link from a run."
            action={
              onNew === undefined ? undefined : (
                <Button size="sm" onClick={onNew}>
                  New tab
                </Button>
              )
            }
          />
        </div>
      ) : null}
      {page !== null && width === null ? page : null}
      {page !== null && width !== null ? (
        <BrowserDeviceFrame width={width}>{page}</BrowserDeviceFrame>
      ) : null}
    </div>
  );
};
