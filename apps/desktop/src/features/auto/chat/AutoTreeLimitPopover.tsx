import { useState } from 'react';
import { autoBudgetUsedUsd, capTextOf, type AutoBudgetFacts } from '@goodboy/core';
import {
  AnchoredPopover,
  Button,
  Chip,
  FormActions,
  Input,
  PopoverBody,
  formatUsd,
  useDropdown,
} from '@goodboy/ui';
import { parseTreeLimit } from './parseTreeLimit';
import type { AutoTreeCapSave } from './useAutoTreeCap';

type Props = {
  readonly facts: AutoBudgetFacts;
  readonly onSave: AutoTreeCapSave;
};

type Choice = 'custom' | 5 | 10 | 20;

const PRESETS: ReadonlyArray<5 | 10 | 20> = [5, 10, 20];
const INPUT_ID = 'auto-tree-limit-amount';
const UNDER_USED = 'The limit must cover spent and reserved usage.';
const NOT_AN_AMOUNT = 'Enter an amount more than zero, with at most 2 decimals.';

type ChoiceParams = {
  readonly capUsd: number;
};

const choiceOf = ({ capUsd }: ChoiceParams): Choice =>
  PRESETS.find((preset) => preset === capUsd) ?? 'custom';

type AmountParams = {
  readonly choice: Choice;
  readonly draft: string;
};

const amountOf = ({ choice, draft }: AmountParams): number | null =>
  choice === 'custom' ? parseTreeLimit({ draft }) : choice;

type ValidationParams = {
  readonly amount: number | null;
  readonly isUnderUsed: boolean;
};

const validationOf = ({ amount, isUnderUsed }: ValidationParams): string | null => {
  if (amount === null) {
    return NOT_AN_AMOUNT;
  }
  return isUnderUsed ? UNDER_USED : null;
};

export const AutoTreeLimitPopover = ({ facts, onSave }: Props) => {
  const dropdown = useDropdown({ align: 'start', width: 'w-80' });
  const { open: isOpen, toggle, close } = dropdown;
  const [choice, setChoice] = useState<Choice>(choiceOf({ capUsd: facts.capUsd }));
  const [draft, setDraft] = useState(String(facts.capUsd));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const usedUsd = autoBudgetUsedUsd({ facts });
  const amount = amountOf({ choice, draft });
  const isUnderUsed = amount !== null && amount + 1e-9 < usedUsd;
  const isUnchanged = amount !== null && amount === facts.capUsd;
  const validation = validationOf({ amount, isUnderUsed });

  const onToggle = () => {
    setChoice(choiceOf({ capUsd: facts.capUsd }));
    setDraft(String(facts.capUsd));
    setError(null);
    toggle();
  };

  const onSet = async () => {
    if (amount === null || isUnderUsed || isSaving) {
      return;
    }
    setIsSaving(true);
    setError(null);
    const failure = await onSave({ expectedCapUsd: facts.capUsd, capUsd: amount });
    setIsSaving(false);
    if (failure === null) {
      close();
      return;
    }
    setError(failure);
  };

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Limit for this conversation"
      className="flex flex-col bg-subtle"
      anchorClassName="inline-flex"
      trigger={
        <Button
          variant="quiet"
          size="xs"
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          className="tabular-nums"
          onClick={onToggle}
        >
          {capTextOf({ facts })}
        </Button>
      }
    >
      <PopoverBody>
        <header className="px-3 pb-1 pt-3 text-row text-foreground">
          Limit for this conversation
        </header>
        <div className="flex flex-col gap-2 px-3 py-2">
          <p className="text-meta tabular-nums text-muted-foreground">
            Spent {formatUsd(facts.spentUsd)}, reserved {formatUsd(facts.reservedUsd)}
          </p>
          <div role="group" aria-label="Limit" className="flex flex-wrap items-center gap-1">
            {PRESETS.map((preset) => (
              <Chip
                key={preset}
                as="button"
                tone={choice === preset ? 'info' : 'neutral'}
                kind="reference"
                label={`$${preset}`}
                ariaPressed={choice === preset}
                disabled={isSaving}
                onClick={() => setChoice(preset)}
              />
            ))}
            <Chip
              as="button"
              tone={choice === 'custom' ? 'info' : 'neutral'}
              kind="reference"
              label="Custom"
              ariaPressed={choice === 'custom'}
              disabled={isSaving}
              onClick={() => setChoice('custom')}
            />
          </div>
          {choice === 'custom' ? (
            <Input
              id={INPUT_ID}
              aria-label="Custom limit in dollars"
              type="text"
              inputMode="decimal"
              value={draft}
              aria-invalid={validation !== null}
              disabled={isSaving}
              onChange={(event) => setDraft(event.target.value)}
            />
          ) : null}
          {validation === null ? null : <p className="text-meta text-danger">{validation}</p>}
          {error === null ? null : <p className="text-meta text-danger">{error}</p>}
        </div>
        <FormActions className="px-3 pb-3 pt-1">
          <Button
            size="sm"
            disabled={validation !== null || isUnchanged || isSaving}
            isBusy={isSaving}
            busyLabel="Saving the limit"
            onClick={() => void onSet()}
          >
            Set limit
          </Button>
        </FormActions>
      </PopoverBody>
    </AnchoredPopover>
  );
};
