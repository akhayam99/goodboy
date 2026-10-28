import { Button, Input } from '@goodboy/ui';
import type { useLimitAmountDraft } from '../../hooks/useLimitAmountDraft';

type Props = {
  readonly label: string;
  readonly inputId: string;
  readonly draft: ReturnType<typeof useLimitAmountDraft>;
  readonly clearLabel?: string;
};

export const LimitAmountForm = ({ label, inputId, draft, clearLabel }: Props) => (
  <form
    aria-label={label}
    onSubmit={(event) => draft.submit({ event })}
    className="flex flex-col gap-1"
  >
    <label htmlFor={inputId} className="text-meta text-muted-foreground">
      Limit in dollars
    </label>
    <Input
      id={inputId}
      type="text"
      inputMode="decimal"
      value={draft.amount}
      aria-invalid={draft.isInvalid}
      disabled={draft.isBusy}
      onChange={(event) => draft.setAmount({ amount: event.target.value })}
    />
    {clearLabel === undefined || draft.amount.trim() === '' ? null : (
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" disabled={draft.isBusy} onClick={draft.clear}>
          {clearLabel}
        </Button>
      </div>
    )}
  </form>
);
