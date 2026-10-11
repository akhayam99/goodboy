import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { ConfirmPopover, IconButton } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../../shared/components/conceptIcons';
import { ConfirmFrame } from './ConfirmFrame';
import { ConfirmRow } from './ConfirmRow';
import { settle } from './variants';

const CHAT_TITLES: ReadonlyArray<string> = [
  'Where is the consent step?',
  'Refund idempotency options',
  'Retry policy for notify-relay',
];

export const ChatRowsFrame = () => {
  const [titles, setTitles] = useState(CHAT_TITLES);
  return (
    <ConfirmFrame name="Chats">
      {titles.map((title) => (
        <ConfirmRow key={title} label={title} meta="2h">
          <span className="group/slot flex items-center opacity-0 motion-safe:transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 group-has-[[aria-expanded=true]]/slot:opacity-100">
            <ConfirmPopover
              role="danger"
              icon={<Trash2 size={ICON_SIZE.row} aria-hidden />}
              title="Delete chat?"
              description="Its messages are removed from this device. Sessions started from it stay."
              confirmLabel="Delete"
              returnFocusTo={{ rowSelector: '[data-confirm-row]' }}
              onConfirm={async () => {
                await settle();
                setTitles((current) => current.filter((candidate) => candidate !== title));
              }}
              trigger={({ arm }) => (
                <IconButton
                  size="xs"
                  icon={Trash2}
                  label={`Delete ${title}`}
                  tooltip="Delete"
                  variant="ghost"
                  data-confirm-trigger
                  className="hover:text-danger"
                  onClick={arm}
                />
              )}
            />
          </span>
        </ConfirmRow>
      ))}
    </ConfirmFrame>
  );
};
