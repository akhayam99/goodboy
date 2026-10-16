import { useEffect, useRef, useState } from 'react';
import { autoBudgetUsedUsd, type AutoBudgetFacts } from '@goodboy/core';
import { capLabelOf } from './capLabelOf';
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
  readonly triggerText?: string;
  readonly turns?: number | null;
  readonly isFromSession: boolean;
  readonly openEvent?: string;
  readonly onSave: AutoTreeCapSave;
};

type Choice = 'custom' | 'none' | 5 | 10 | 20;

type Pick = Readonly<{ capUsd: number | null }>;

const PRESETS: ReadonlyArray<5 | 10 | 20> = [5, 10, 20];
const INPUT_ID = 'auto-tree-limit-amount';
const UNDER_USED = 'The limit must cover spent and reserved usage.';
const NOT_AN_AMOUNT = 'Enter an amount more than zero, with at most 2 decimals.';
const SESSION_SETS_IT = 'The session budget sets this limit, so it keeps one.';

type ChoiceParams = {
  readonly capUsd: number | null;
};

const choiceOf = ({ capUsd }: ChoiceParams): Choice => {
  if (capUsd === null) {
    return 'none';
  }
  return PRESETS.find((preset) => preset === capUsd) ?? 'custom';
};

type PickParams = {
  readonly choice: Choice;
  readonly draft: string;
};

const pickOf = ({ choice, draft }: PickParams): Pick | null => {
  if (choice === 'none') {
    return { capUsd: null };
  }
  if (choice === 'custom') {
    const parsed = parseTreeLimit({ draft });
    return parsed === null ? null : { capUsd: parsed };
  }
  return { capUsd: choice };
};

type ValidationParams = {
  readonly pick: Pick | null;
  readonly usedUsd: number;
};

const validationOf = ({ pick, usedUsd }: ValidationParams): string | null => {
  if (pick === null) {
    return NOT_AN_AMOUNT;
  }
  if (pick.capUsd !== null && pick.capUsd + 1e-9 < usedUsd) {
    return UNDER_USED;
  }
  return null;
};

const LIMIT_TITLE = 'Limit for this Auto run';

export const AutoTreeLimitPopover = ({
  facts,
  triggerText,
  turns = null,
  isFromSession,
  openEvent,
  onSave,
}: Props) => {
  const dropdown = useDropdown({ align: 'start', width: 'w-80' });
  const { open: isOpen, toggle, close } = dropdown;
  const [choice, setChoice] = useState<Choice>(choiceOf({ capUsd: facts.capUsd }));
  const [draft, setDraft] = useState(facts.capUsd === null ? '' : String(facts.capUsd));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const pick = pickOf({ choice, draft });
  const validation = validationOf({ pick, usedUsd: autoBudgetUsedUsd({ facts }) });
  const isUnchanged = pick !== null && pick.capUsd === facts.capUsd;

  const onToggle = () => {
    setChoice(choiceOf({ capUsd: facts.capUsd }));
    setDraft(facts.capUsd === null ? '' : String(facts.capUsd));
    setError(null);
    toggle();
  };
  const onToggleRef = useRef(onToggle);
  onToggleRef.current = onToggle;

  useEffect(() => {
    if (openEvent === undefined) {
      return;
    }
    const open = () => {
      if (isOpen) {
        return;
      }
      onToggleRef.current();
    };
    window.addEventListener(openEvent, open);
    return () => window.removeEventListener(openEvent, open);
  }, [openEvent, isOpen]);

  const onSet = async () => {
    if (pick === null || validation !== null || isSaving) {
      return;
    }
    setIsSaving(true);
    setError(null);
    const failure = await onSave({ expectedCapUsd: facts.capUsd, capUsd: pick.capUsd });
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
      ariaLabel={LIMIT_TITLE}
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
          {triggerText ?? capLabelOf({ facts })}
        </Button>
      }
    >
      <PopoverBody>
        <header className="px-3 pb-1 pt-3 text-row text-foreground">{LIMIT_TITLE}</header>
        <div className="flex flex-col gap-2 px-3 py-2">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-meta tabular-nums">
            <dt className="text-muted-foreground">Spent</dt>
            <dd className="text-right text-foreground">{formatUsd(facts.spentUsd)}</dd>
            <dt className="text-muted-foreground">Reserved</dt>
            <dd className="text-right text-foreground">{formatUsd(facts.reservedUsd)}</dd>
            {turns === null || turns === 0 ? null : (
              <>
                <dt className="text-muted-foreground">Turns</dt>
                <dd className="text-right text-foreground">{turns}</dd>
              </>
            )}
          </dl>
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
              tone={choice === 'none' ? 'info' : 'neutral'}
              kind="reference"
              label="No limit"
              ariaPressed={choice === 'none'}
              disabled={isSaving || isFromSession}
              {...(isFromSession && { title: SESSION_SETS_IT })}
              onClick={() => setChoice('none')}
            />
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
          {isFromSession ? (
            <p className="text-meta text-muted-foreground">{SESSION_SETS_IT}</p>
          ) : null}
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
