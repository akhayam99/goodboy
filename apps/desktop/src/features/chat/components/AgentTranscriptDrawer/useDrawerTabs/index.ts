import { useEffect, useState } from 'react';

export type DrawerTab = 'lead' | 'transcript';

type Params = {
  readonly isLeadPreferred: boolean;
  readonly leadAlertCount: number;
  readonly transcriptCount: number;
};

type Result = {
  readonly tab: DrawerTab;
  readonly pickTab: (tab: DrawerTab) => void;
  readonly hasLeadDot: boolean;
  readonly hasTranscriptDot: boolean;
};

export const useDrawerTabs = ({
  isLeadPreferred,
  leadAlertCount,
  transcriptCount,
}: Params): Result => {
  const [pickedTab, setPickedTab] = useState<DrawerTab | null>(null);
  const [seenTranscript, setSeenTranscript] = useState(transcriptCount);
  const [seenAlerts, setSeenAlerts] = useState(leadAlertCount);
  const tab = pickedTab ?? (isLeadPreferred ? 'lead' : 'transcript');

  useEffect(() => {
    setSeenTranscript((seen) =>
      tab === 'transcript' ? transcriptCount : Math.min(seen, transcriptCount),
    );
  }, [tab, transcriptCount]);

  useEffect(() => {
    setSeenAlerts((seen) => (tab === 'lead' ? leadAlertCount : Math.min(seen, leadAlertCount)));
  }, [tab, leadAlertCount]);

  return {
    tab,
    pickTab: setPickedTab,
    hasLeadDot: tab === 'transcript' && leadAlertCount > seenAlerts,
    hasTranscriptDot: tab === 'lead' && transcriptCount > seenTranscript,
  };
};
