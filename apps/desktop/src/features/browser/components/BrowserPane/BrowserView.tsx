import type { RefObject } from 'react';
import { EmptyState } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { MOCK_ENABLED } from '../../../../shared/lib/mockMode';
import type { DevicePresetId } from '../../../../store/slices/browser/types';
import type { ShownTab } from '../../types';
import type { CoverReason } from '../../createOverlayWatch';
import { devicePresetOf } from '../../devicePresets';
import { BrowserCover } from './BrowserCover';
import { BrowserDeviceFrame } from './BrowserDeviceFrame';
import { BrowserViewStandIn } from './BrowserViewStandIn';

type Props = {
  readonly frame: RefObject<HTMLDivElement | null>;
  readonly view: RefObject<HTMLDivElement | null>;
  readonly shown: ShownTab | null;
  readonly title: string;
  readonly cover: CoverReason | null;
  readonly devicePreset?: DevicePresetId;
  readonly emptyTitle?: string;
};

export const BrowserView = ({
  frame,
  view,
  shown,
  title,
  cover,
  devicePreset = 'desktop',
  emptyTitle = 'Open a page beside the session',
}: Props) => {
  const width = devicePresetOf({ id: devicePreset }).width;
  const page =
    shown === null ? null : (
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
      className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border-soft bg-background"
    >
      {page === null ? (
        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
          <EmptyState
            icon={CONCEPT_ICONS.browser}
            title={emptyTitle}
            description="A localhost address opens your dev server."
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
