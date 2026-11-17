import {
  AnchoredPopover,
  Button,
  POPOVER_WIDTH_CLASS,
  POPOVER_WIDTH_PX,
  useDropdown,
} from '@goodboy/ui';
import {
  REPLY_TEMPLATE_VARIABLES,
  type ReplyTemplateVariable,
} from '../../../resolve/renderReplyTemplate';

type Props = {
  readonly targetLabel: string;
  readonly isDisabled: boolean;
  readonly onInsert: (name: ReplyTemplateVariable) => void;
};

export const ReplyPlaceholderInsert = ({ targetLabel, isDisabled, onInsert }: Props) => {
  const dropdown = useDropdown({
    expectedHeight: 120,
    expectedWidth: POPOVER_WIDTH_PX.compact,
    width: POPOVER_WIDTH_CLASS.compact,
  });
  const title = `Insert into ${targetLabel}`;

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel={title}
      className="flex flex-col gap-2 p-3"
      anchorClassName="inline-flex shrink-0"
      trigger={
        <Button
          variant="ghost"
          size="xs"
          aria-label={title}
          aria-haspopup="dialog"
          aria-expanded={dropdown.open}
          onClick={dropdown.toggle}
        >
          Insert
        </Button>
      }
    >
      <p className="text-meta text-muted-foreground">{title}</p>
      <div role="group" aria-label="Placeholders" className="flex flex-wrap gap-1">
        {REPLY_TEMPLATE_VARIABLES.map((name) => (
          <Button
            key={name}
            variant="secondary"
            size="xs"
            className="font-mono"
            disabled={isDisabled}
            onClick={() => {
              onInsert(name);
              dropdown.close();
            }}
          >
            {`{${name}}`}
          </Button>
        ))}
      </div>
    </AnchoredPopover>
  );
};
