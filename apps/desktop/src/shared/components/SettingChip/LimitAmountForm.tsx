import { Input } from '@goodboy/ui';
import type { useLimitAmountDraft } from '../../hooks/useLimitAmountDraft';

type Props = {
  readonly label: string;
  readonly inputId: string;
  readonly draft: ReturnType<typeof useLimitAmountDraft>;
};

export const LimitAmountForm = ({ label, inputId, draft }: Props) => (
  <form aria-label={label} onSubmit={draft.submit} className="flex flex-col gap-1">
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
  </form>
);
