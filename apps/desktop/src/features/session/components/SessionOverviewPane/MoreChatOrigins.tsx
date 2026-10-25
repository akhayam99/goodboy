import {
  AnchoredPopover,
  cn,
  FOCUS_RING,
  ICON_SIZE,
  SelectableRow,
  useDropdown,
} from '@goodboy/ui';
import type { ChatOrigin } from '../../../../store/slices/chats/selectChatOrigins';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';

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
            <SelectableRow
              selected={false}
              onClick={() => {
                dropdown.close();
                onOpen(origin);
              }}
              className="min-w-0 items-center gap-2 px-2 py-1 text-meta"
            >
              <CONCEPT_ICONS.chat size={ICON_SIZE.row} aria-hidden className="shrink-0" />
              <span className="min-w-0 truncate">{labelOf({ origin })}</span>
            </SelectableRow>
          </li>
        ))}
      </ul>
    </AnchoredPopover>
  );
};
