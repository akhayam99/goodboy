import { ChevronDown } from 'lucide-react';
import {
  AnchoredPopover,
  Button,
  ICON_SIZE,
  ScrollFade,
  SelectableRow,
  cn,
  useDropdown,
} from '@goodboy/ui';
import { RUN_ROUTE_COPY } from '../../startRun/runRouteCopy';
import type { RunAs, RunAsChoice } from '../../startRun/runAsOf';

type ChooseParams = {
  readonly runAs: RunAs;
};

type Props = {
  readonly label: string;
  readonly choices: ReadonlyArray<RunAsChoice>;
  readonly isDisabled: boolean;
  readonly onChoose: (params: ChooseParams) => void;
};

export const RunAsChip = ({ label, choices, isDisabled, onChoose }: Props) => {
  const dropdown = useDropdown({
    disabled: isDisabled,
    expectedHeight: 320,
    expectedWidth: 320,
    width: 'w-80',
  });
  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel={RUN_ROUTE_COPY.runAs.menu}
      anchorClassName="inline-flex"
      className="flex flex-col p-1"
      trigger={
        <Button
          size="xs"
          variant="secondary"
          disabled={isDisabled}
          aria-haspopup="dialog"
          aria-expanded={dropdown.open}
          aria-label={`${RUN_ROUTE_COPY.runAs.label}: ${label}`}
          data-setting-chip={RUN_ROUTE_COPY.runAs.label}
          onClick={dropdown.toggle}
          className={cn(dropdown.open && 'bg-selected')}
        >
          <span className="text-muted-foreground">{RUN_ROUTE_COPY.runAs.label}</span>
          <span className="text-foreground">{label}</span>
          <ChevronDown
            size={ICON_SIZE.row}
            aria-hidden
            className="shrink-0 text-faint-foreground"
          />
        </Button>
      }
    >
      <ScrollFade className="max-h-72" viewportClassName="flex flex-col">
        {choices.map((choice) => (
          <SelectableRow
            key={choice.key}
            selected={choice.label === label}
            onClick={() => {
              onChoose({ runAs: choice.runAs });
              dropdown.close();
            }}
            className="min-w-0 items-center px-2 py-1 text-ui text-foreground"
          >
            <span className="min-w-0 truncate">{choice.label}</span>
          </SelectableRow>
        ))}
      </ScrollFade>
    </AnchoredPopover>
  );
};
