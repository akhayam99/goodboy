import { useState } from 'react';
import { AnchoredPopover, Button, Chip, Input, formatUsd, useDropdown } from '@goodboy/ui';
import { parseSpendLimit } from '../budget/parseSpendLimit';

type Props = {
  readonly usd: number | null;
  readonly isFromSession: boolean;
  readonly isDisabled: boolean;
  readonly onChange: (usd: number | null) => void;
};

type TextParams = {
  readonly usd: number | null;
};

const INPUT_ID = 'auto-tree-limit';

const NO_LIMIT = 'No limit';

const chipLabelOf = ({ usd }: TextParams): string =>
  usd === null ? NO_LIMIT : `Limit ${formatUsd(usd)}`;

const amountTextOf = ({ usd }: TextParams): string => (usd === null ? '' : String(usd));

export const AutoLimitChip = ({ usd, isFromSession, isDisabled, onChange }: Props) => {
  const dropdown = useDropdown({ disabled: isDisabled, width: 'w-80' });
  const { open: isOpen, toggle, close } = dropdown;
  const [draft, setDraft] = useState(amountTextOf({ usd }));
  const parsed = parseSpendLimit(draft);
  const isInvalid = draft.trim() !== '' && parsed === null;

  if (isFromSession) {
    return (
      <Chip
        tone="neutral"
        kind="reference"
        label={chipLabelOf({ usd })}
        title="From the budget of this session"
      />
    );
  }

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Limit for this Auto run"
      className="flex flex-col gap-3 p-3"
      trigger={
        <Chip
          tone="neutral"
          kind="reference"
          as="button"
          label={chipLabelOf({ usd })}
          expanded={isOpen}
          hasPopup="dialog"
          disabled={isDisabled}
          onClick={() => {
            setDraft(amountTextOf({ usd }));
            toggle();
          }}
        />
      }
    >
      <label htmlFor={INPUT_ID} className="text-meta text-foreground">
        Limit for this Auto run
      </label>
      <p className="text-meta text-muted-foreground">
        The most Auto and the agents it starts may spend. Without a limit, Auto only stops when the
        work is done. Other Auto runs in this workspace start from the same limit.
      </p>
      <Input
        id={INPUT_ID}
        type="text"
        inputMode="decimal"
        value={draft}
        aria-invalid={isInvalid}
        onChange={(event) => setDraft(event.target.value)}
      />
      {isInvalid ? <p className="text-meta text-danger">Enter an amount more than zero.</p> : null}
      <div className="flex justify-end gap-2">
        {usd === null ? null : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange(null);
              close();
            }}
          >
            {NO_LIMIT}
          </Button>
        )}
        <Button
          size="sm"
          disabled={parsed === null}
          onClick={() => {
            if (parsed !== null) {
              onChange(parsed);
              close();
            }
          }}
        >
          Use this limit
        </Button>
      </div>
    </AnchoredPopover>
  );
};
