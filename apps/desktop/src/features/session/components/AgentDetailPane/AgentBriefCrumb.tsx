import { AnchoredPopover, FOCUS_RING, PopoverBody, cn, useDropdown } from '@goodboy/ui';
import { firstLineOf } from './firstLineOf';

type Props = {
  readonly brief: string;
  readonly onRename: () => void;
};

export const AgentBriefCrumb = ({ brief, onRename }: Props) => {
  const dropdown = useDropdown({
    align: 'start',
    expectedHeight: 240,
    expectedWidth: 480,
    width: 'w-[30rem] max-w-[calc(100vw-2rem)]',
  });
  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Full brief"
      className="max-h-72"
      anchorClassName="flex min-w-0"
      trigger={
        <button
          type="button"
          aria-label={dropdown.open ? 'Hide full brief' : 'Read full brief'}
          aria-expanded={dropdown.open}
          onClick={dropdown.toggle}
          onDoubleClick={onRename}
          className={cn('min-w-0 truncate rounded-sm text-left', FOCUS_RING)}
        >
          {firstLineOf({ text: brief }) ?? brief}
        </button>
      }
    >
      <PopoverBody>
        <p className="whitespace-pre-wrap break-words p-3 text-meta text-foreground">{brief}</p>
      </PopoverBody>
    </AnchoredPopover>
  );
};
