import type { SlotKey } from '@goodboy/core';
import type { SessionId } from '@goodboy/types';
import { DrawerFrame } from '@goodboy/ui';
import { History } from 'lucide-react';
import { useAppStore, useSlotHistory } from '../../../../../store';
import { SlotHistoryPanel } from './SlotHistoryPanel';

const SLOT_LABEL: Readonly<Record<SlotKey, string>> = {
  goal: 'Goal',
  files_touched: 'Files touched',
  decisions: 'Decisions',
  open_questions: 'Open questions',
  last_output_summary: 'Session summary',
};

type Props = {
  readonly sessionId: SessionId;
  readonly slotKey: SlotKey;
  readonly onClose: () => void;
};

export const SlotHistoryDrawer = ({ sessionId, slotKey, onClose }: Props) => {
  const entries = useSlotHistory(sessionId, slotKey);
  const upsertSessionSlot = useAppStore((s) => s.upsertSessionSlot);
  const label = SLOT_LABEL[slotKey];

  return (
    <DrawerFrame
      title={`History: ${label}`}
      icon={History}
      iconClassName="text-muted-foreground"
      count={entries.length > 0 ? entries.length : undefined}
      closeLabel="Close history"
      onClose={onClose}
    >
      <SlotHistoryPanel
        renderAsMarkdown={slotKey !== 'goal'}
        entries={entries}
        onRestore={(entry) => {
          void upsertSessionSlot(sessionId, slotKey, entry.value);
          onClose();
        }}
      />
    </DrawerFrame>
  );
};
