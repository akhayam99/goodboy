import { SegmentedTabs, StatusDot, type SegmentedTabOption } from '@goodboy/ui';
import { TRANSCRIPT_DRAWER_COPY } from './transcriptDrawerCopy';
import type { DrawerTab } from './useDrawerTabs';

type Props = {
  readonly tab: DrawerTab;
  readonly onPick: (tab: DrawerTab) => void;
  readonly hasLeadDot: boolean;
  readonly hasTranscriptDot: boolean;
};

export const DrawerTabs = ({ tab, onPick, hasLeadDot, hasTranscriptDot }: Props) => {
  const options = [
    {
      value: 'lead',
      label: TRANSCRIPT_DRAWER_COPY.leadTab,
      badge: hasLeadDot ? (
        <StatusDot
          tone="warning"
          size="sm"
          role="status"
          ariaLabel={TRANSCRIPT_DRAWER_COPY.leadDot}
        />
      ) : undefined,
    },
    {
      value: 'transcript',
      label: TRANSCRIPT_DRAWER_COPY.transcriptTab,
      badge: hasTranscriptDot ? (
        <StatusDot
          tone="primary"
          size="sm"
          role="status"
          ariaLabel={TRANSCRIPT_DRAWER_COPY.transcriptDot}
        />
      ) : undefined,
    },
  ] satisfies ReadonlyArray<SegmentedTabOption<DrawerTab>>;

  return (
    <SegmentedTabs
      ariaLabel={TRANSCRIPT_DRAWER_COPY.tabsLabel}
      options={options}
      value={tab}
      onChange={onPick}
      size="xs"
      fill
    />
  );
};
