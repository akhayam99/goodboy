import { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button, InlineConfirm, Input, formatUsd } from '@goodboy/ui';
import { parseCap } from '../../../../shared/lib/parse-cap';
import { StudioWidget } from '../../../../shared/components/StudioWidget';

type Props = {
  readonly label: string;
  readonly hint?: string;
  readonly currentCapUsd: number | null;
  readonly placeholder?: string;
  readonly onSave: (capUsd: number) => Promise<void>;
  readonly onRemove?: () => Promise<void>;
};

export const CapEditor = ({
  label,
  hint,
  currentCapUsd,
  placeholder = 'e.g. 50',
  onSave,
  onRemove,
}: Props) => {
  const [draft, setDraft] = useState(currentCapUsd !== null ? String(currentCapUsd) : '');
  const [busy, setBusy] = useState(false);
  const [removeArmed, setRemoveArmed] = useState(false);
  const previousCapRef = useRef(currentCapUsd);

  useEffect(() => {
    const previousCap = previousCapRef.current;
    const previousValue = previousCap !== null ? String(previousCap) : '';
    const nextValue = currentCapUsd !== null ? String(currentCapUsd) : '';
    setDraft((currentValue) => (currentValue === previousValue ? nextValue : currentValue));
    previousCapRef.current = currentCapUsd;
  }, [currentCapUsd]);

  const parsed = parseCap(draft);
  const unchanged = parsed !== null && parsed === currentCapUsd;
  const canSave = parsed !== null && !unchanged && !busy;

  const save = async () => {
    if (parsed === null) {
      return;
    }
    setBusy(true);
    try {
      await onSave(parsed);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!onRemove) {
      return;
    }
    setBusy(true);
    try {
      await onRemove();
    } finally {
      setBusy(false);
      setRemoveArmed(false);
    }
  };

  if (removeArmed && currentCapUsd !== null) {
    return (
      <StudioWidget label={label} hint={hint}>
        <InlineConfirm
          role="alert"
          icon={<Trash2 size={12} aria-hidden />}
          title={`Remove the ${formatUsd(currentCapUsd)} cap?`}
          confirmLabel="Remove"
          isBusy={busy}
          autoDisarmMs={4000}
          onConfirm={remove}
          onCancel={() => setRemoveArmed(false)}
        />
      </StudioWidget>
    );
  }

  return (
    <StudioWidget label={label} hint={hint}>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">$</span>
        <Input
          type="text"
          inputMode="decimal"
          value={draft}
          placeholder={placeholder}
          disabled={busy}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canSave) {
              void save();
            }
          }}
          className="max-w-40 font-mono tabular-nums"
          aria-label={label}
        />
        <Button variant="primary" size="sm" disabled={!canSave} onClick={() => void save()}>
          {currentCapUsd !== null ? 'Update cap' : 'Set cap'}
        </Button>
        {currentCapUsd !== null && onRemove ? (
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => setRemoveArmed(true)}>
            Remove
          </Button>
        ) : null}
        {currentCapUsd !== null ? (
          <span className="ml-auto text-2xs text-muted-foreground tabular-nums">
            current {formatUsd(currentCapUsd)}
          </span>
        ) : null}
      </div>
    </StudioWidget>
  );
};
