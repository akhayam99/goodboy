import { AnchoredPopover, Button, PopoverBody, useDropdown } from '@goodboy/ui';
import { firstLineOf } from './firstLineOf';

type Props = {
  readonly brief: string;
  readonly onRename: () => void;
};

export const AgentBriefCrumb = ({ brief, onRename }: Props) => {
  const dropdown = useDropdown({
    align: 'start',
    expectedHeight: 240,
    expectedWidth: 384,
    width: 'w-96 max-w-[calc(100vw-2rem)]',
  });
  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Full brief"
      className="max-h-72"
      anchorClassName="flex min-w-0"
      trigger={
        <Button
          variant="ghost"
          size="xs"
          aria-label={dropdown.open ? 'Hide full brief' : 'Read full brief'}
          aria-expanded={dropdown.open}
          onClick={dropdown.toggle}
          onDoubleClick={onRename}
          className="min-w-0 max-w-full px-1"
        >
          <span className="min-w-0 truncate">{firstLineOf({ text: brief }) ?? brief}</span>
        </Button>
      }
    >
      <PopoverBody>
        <p className="whitespace-pre-wrap break-words p-3 text-meta text-foreground">{brief}</p>
      </PopoverBody>
    </AnchoredPopover>
  );
};
