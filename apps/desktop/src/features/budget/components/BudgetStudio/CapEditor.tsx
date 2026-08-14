import { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button, Divider, InlineConfirm, Input, formatUsd } from '@goodboy/ui';
import { parseCap } from '../../../../shared/lib/parse-cap';
import { StudioWidget } from '@goodboy/ui';

type Threshold = {
  readonly pct: number;
  readonly onSave: (thresholdPct: number) => Promise<void>;
};

type Props = {
  readonly label: string;
  readonly hint?: string;
  readonly currentCapUsd: number | null;
  readonly placeholder?: string;
  readonly threshold?: Threshold;
  readonly onSave: (capUsd: number) => Promise<void>;
  readonly onRemove?: () => Promise<void>;
};

const parseThresholdPct = (raw: string): number | null => {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100) {
    return null;
  }
  return Math.round(parsed);
};

export const CapEditor = ({
  label,
  hint,
  currentCapUsd,
  placeholder = 'e.g. 50',
  threshold,
  onSave,
  onRemove,
}: Props) => {
  const [draft, setDraft] = useState(currentCapUsd !== null ? String(currentCapUsd) : '');
  const [busy, setBusy] = useState(false);
  const [removeArmed, setRemoveArmed] = useState(false);
  const previousCapRef = useRef(currentCapUsd);
  const [thresholdDraft, setThresholdDraft] = useState(
    threshold !== undefined ? String(threshold.pct) : '',
  );
  const previousThresholdRef = useRef(threshold?.pct ?? null);

  useEffect(() => {
    const previousCap = previousCapRef.current;
    const previousValue = previousCap !== null ? String(previousCap) : '';
    const nextValue = currentCapUsd !== null ? String(currentCapUsd) : '';
    setDraft((currentValue) => (currentValue === previousValue ? nextValue : currentValue));
    previousCapRef.current = currentCapUsd;
  }, [currentCapUsd]);

  useEffect(() => {
    const nextPct = threshold?.pct ?? null;
    const previousPct = previousThresholdRef.current;
    const previousValue = previousPct !== null ? String(previousPct) : '';
    const nextValue = nextPct !== null ? String(nextPct) : '';
    setThresholdDraft((currentValue) =>
      currentValue === previousValue ? nextValue : currentValue,
    );
    previousThresholdRef.current = nextPct;
  }, [threshold?.pct]);

  const parsed = parseCap(draft);
  const unchanged = parsed !== null && parsed === currentCapUsd;
  const canSave = parsed !== null && !unchanged && !busy;

  const parsedThreshold = parseThresholdPct(thresholdDraft);
  const canSaveThreshold =
    threshold !== undefined && parsedThreshold !== null && parsedThreshold !== threshold.pct;

  const saveThreshold = async () => {
    if (threshold === undefined || parsedThreshold === null) {
      return;
    }
    setBusy(true);
    try {
      await threshold.onSave(parsedThreshold);
    } finally {
      setBusy(false);
    }
  };

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
      {threshold !== undefined && currentCapUsd !== null ? (
        <>
          <Divider />
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">at</span>
              <Input
                type="text"
                inputMode="numeric"
                value={thresholdDraft}
                placeholder="80"
                disabled={busy}
                onChange={(e) => setThresholdDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canSaveThreshold && !busy) {
                    void saveThreshold();
                  }
                }}
                className="max-w-20 font-mono tabular-nums"
                aria-label="alert threshold percent"
              />
              <span className="text-sm text-muted-foreground">% of the cap</span>
              <Button
                variant="secondary"
                size="sm"
                disabled={!canSaveThreshold || busy}
                onClick={() => void saveThreshold()}
              >
                Update threshold
              </Button>
            </div>
            <p className="text-2xs text-muted-foreground">
              this number does two things: it raises the budget alert, and it moves the next turn to
              another provider. spend above it still runs here if no other provider has room.
            </p>
          </div>
        </>
      ) : null}
    </StudioWidget>
  );
};
