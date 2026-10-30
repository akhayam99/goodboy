import { useState } from 'react';
import {
  AnchoredPopover,
  Button,
  Chip,
  Input,
  POPOVER_WIDTH_CLASS,
  POPOVER_WIDTH_PX,
  TEXT_ROLE,
  useDropdown,
} from '@goodboy/ui';
import { parseSpendLimit } from '../budget/parseSpendLimit';
import { AutoLimitChoices } from './AutoLimitChoices';
import { AUTO_LIMIT_COPY, type AutoLimitKind } from './autoLimitCopy';
import type { AutoTreeLimitModel } from './useAutoTreeLimit';

type Props = {
  readonly limit: Pick<
    AutoTreeLimitModel,
    'usd' | 'isFromSession' | 'isDefault' | 'defaultUsd' | 'change'
  >;
  readonly kind: AutoLimitKind;
  readonly isDisabled: boolean;
};

type TextParams = {
  readonly usd: number | null;
};

const INPUT_ID = 'auto-tree-limit';

const POPOVER_HEIGHT_PX = 280;

const amountTextOf = ({ usd }: TextParams): string => (usd === null ? '' : String(usd));

export const AutoLimitChip = ({ limit, kind, isDisabled }: Props) => {
  const { usd, isFromSession, isDefault, defaultUsd, change } = limit;
  const dropdown = useDropdown({
    disabled: isDisabled,
    width: POPOVER_WIDTH_CLASS.standard,
    expectedWidth: POPOVER_WIDTH_PX.standard,
    expectedHeight: POPOVER_HEIGHT_PX,
  });
  const { open: isOpen, toggle, close } = dropdown;
  const [draft, setDraft] = useState(amountTextOf({ usd }));
  const parsed = parseSpendLimit(draft);
  const isInvalid = draft.trim() !== '' && parsed === null;
  const title = AUTO_LIMIT_COPY.titleOf({ kind });
  const label = (
    <>
      {AUTO_LIMIT_COPY.labelOf({ usd })}
      {isDefault ? (
        <span className={TEXT_ROLE.hint}>{`· ${AUTO_LIMIT_COPY.defaultTag}`}</span>
      ) : null}
    </>
  );

  if (isFromSession) {
    return (
      <Chip tone="neutral" kind="reference" label={label} title={AUTO_LIMIT_COPY.fromSession} />
    );
  }

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel={title}
      className="flex flex-col gap-3 p-3"
      trigger={
        <Chip
          tone="neutral"
          kind="reference"
          as="button"
          label={label}
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
      <p className="text-meta text-foreground">{title}</p>
      <p className="text-meta text-muted-foreground">{AUTO_LIMIT_COPY.helpOf({ kind })}</p>
      <AutoLimitChoices
        usd={usd}
        defaultUsd={defaultUsd}
        onPick={(amount) => {
          change(amount);
          close();
        }}
      />
      <label htmlFor={INPUT_ID} className="text-meta text-muted-foreground">
        {AUTO_LIMIT_COPY.other}
      </label>
      <Input
        id={INPUT_ID}
        type="text"
        inputMode="decimal"
        value={draft}
        aria-invalid={isInvalid}
        onChange={(event) => setDraft(event.target.value)}
      />
      {isInvalid ? <p className="text-meta text-danger">{AUTO_LIMIT_COPY.invalid}</p> : null}
      <div className="flex justify-end gap-2">
        {usd === null ? null : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              change(null);
              close();
            }}
          >
            {AUTO_LIMIT_COPY.noLimit}
          </Button>
        )}
        <Button
          size="sm"
          disabled={parsed === null}
          onClick={() => {
            if (parsed !== null) {
              change(parsed);
              close();
            }
          }}
        >
          {AUTO_LIMIT_COPY.use}
        </Button>
      </div>
    </AnchoredPopover>
  );
};
