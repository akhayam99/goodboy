import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { ConfirmPopover, IconButton } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../../shared/components/conceptIcons';
import { ConfirmFrame } from './ConfirmFrame';
import { ConfirmRow } from './ConfirmRow';
import { settle } from './variants';

const NOTES: ReadonlyArray<string> = [
  'Rename the ledger-core export before merging',
  'Cover the empty batch in payments-api',
];

export const NoteFrame = () => {
  const [notes, setNotes] = useState(NOTES);
  return (
    <ConfirmFrame name="Your notes">
      {notes.map((note) => (
        <ConfirmRow key={note} label={note}>
          <ConfirmPopover
            role="danger"
            icon={<Trash2 size={ICON_SIZE.row} aria-hidden />}
            title="Delete this note?"
            description="It is removed from your review draft."
            confirmLabel="Delete"
            returnFocusTo={{ rowSelector: '[data-confirm-row]' }}
            onConfirm={async () => {
              await settle();
              setNotes((current) => current.filter((candidate) => candidate !== note));
            }}
            trigger={({ isArmed, arm }) => (
              <IconButton
                icon={Trash2}
                label={`Delete note ${note}`}
                tooltip="Delete note"
                variant="ghost"
                data-confirm-trigger
                aria-expanded={isArmed}
                onClick={arm}
              />
            )}
          />
        </ConfirmRow>
      ))}
    </ConfirmFrame>
  );
};
