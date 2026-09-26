import { useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore, useSlotHistory } from '../../../../store';
import { SlotHistoryPanel } from '../SessionWorkspace/parts/SlotHistoryPanel';
import type { ContextSlotKey } from './contextTabs';

type Props = {
  readonly sessionId: SessionId;
  readonly slotKey: ContextSlotKey;
  readonly backLabel: string;
  readonly onBack: () => void;
};

export const VersionsView = ({ sessionId, slotKey, backLabel, onBack }: Props) => {
  const entries = useSlotHistory(sessionId, slotKey);
  const loadSlotHistory = useAppStore((state) => state.loadSlotHistory);
  const upsertSessionSlot = useAppStore((state) => state.upsertSessionSlot);

  useEffect(() => {
    void loadSlotHistory(sessionId, slotKey);
  }, [loadSlotHistory, sessionId, slotKey]);

  return (
    <div className="flex flex-col gap-3">
      <Button variant="ghost" size="sm" className="self-start" onClick={onBack}>
        <ChevronLeft size={12} aria-hidden />
        {backLabel}
      </Button>
      <SlotHistoryPanel
        renderAsMarkdown={slotKey !== 'goal'}
        entries={entries}
        onRestore={(entry) => {
          void upsertSessionSlot(sessionId, slotKey, entry.value);
          onBack();
        }}
      />
    </div>
  );
};
