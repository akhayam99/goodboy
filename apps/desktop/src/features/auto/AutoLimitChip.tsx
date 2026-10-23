import { useState } from 'react';
import { AnchoredPopover, Button, Chip, Input, formatUsd, useDropdown } from '@goodboy/ui';
import { parseSpendLimit } from '../budget/parseSpendLimit';

type Props = {
  readonly usd: number;
  readonly isFromSession: boolean;
  readonly isDisabled: boolean;
  readonly onChange: (usd: number) => void;
};

const INPUT_ID = 'auto-tree-limit';

export const AutoLimitChip = ({ usd, isFromSession, isDisabled, onChange }: Props) => {
  const dropdown = useDropdown({ disabled: isDisabled, width: 'w-80' });
  const { open: isOpen, toggle, close } = dropdown;
  const [draft, setDraft] = useState(String(usd));
  const parsed = parseSpendLimit(draft);

  if (isFromSession) {
    return (
      <Chip
        tone="neutral"
        kind="reference"
        label={`Limit ${formatUsd(usd)}`}
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
          label={`Limit ${formatUsd(usd)}`}
          expanded={isOpen}
          hasPopup="dialog"
          disabled={isDisabled}
          onClick={() => {
            setDraft(String(usd));
            toggle();
          }}
        />
      }
    >
      <label htmlFor={INPUT_ID} className="text-label text-foreground">
        Limit for this Auto run
      </label>
      <p className="text-meta text-muted-foreground">
        The most Auto and the agents it starts may spend. Auto stops starting work when it is spent.
        Other Auto runs in this workspace start from the same limit.
      </p>
      <Input
        id={INPUT_ID}
        type="text"
        inputMode="decimal"
        value={draft}
        aria-invalid={parsed === null}
        onChange={(event) => setDraft(event.target.value)}
      />
      {parsed === null ? (
        <p className="text-meta text-danger">Enter an amount more than zero.</p>
      ) : null}
      <div className="flex justify-end">
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
