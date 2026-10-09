import { ROW_INTERACTIVE, AnchoredPopover, FOCUS_RING, cn, useDropdown } from '@goodboy/ui';
import type { ChatOrigin } from '../../../../store/slices/chats/selectChatOrigins';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly origins: ReadonlyArray<ChatOrigin>;
  readonly onOpen: (origin: ChatOrigin) => void;
  readonly labelOf: (params: { readonly origin: ChatOrigin }) => string;
};

export const MoreChatOrigins = ({ origins, onOpen, labelOf }: Props) => {
  const dropdown = useDropdown({ align: 'start', width: 'w-80', expectedHeight: 160 });
  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Other chats"
      anchorClassName="shrink-0"
      trigger={
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={dropdown.open}
          onClick={dropdown.toggle}
          className={cn(
            'rounded-sm text-meta text-faint-foreground motion-safe:transition-colors hover:text-foreground',
            FOCUS_RING,
          )}
        >
          {`+${origins.length} more`}
        </button>
      }
    >
      <ul className="flex flex-col p-1">
        {origins.map((origin) => (
          <li key={origin.chatId}>
            <button
              type="button"
              onClick={() => {
                dropdown.close();
                onOpen(origin);
              }}
              className={cn(
                'flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left text-label text-muted-foreground hover:text-foreground',
                ROW_INTERACTIVE,
                FOCUS_RING,
              )}
            >
              <CONCEPT_ICONS.chat size={ICON_SIZE.row} aria-hidden className="shrink-0" />
              <span className="min-w-0 truncate">{labelOf({ origin })}</span>
            </button>
          </li>
        ))}
      </ul>
    </AnchoredPopover>
  );
};
