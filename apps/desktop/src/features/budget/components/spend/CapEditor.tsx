import { useEffect, useRef, useState } from 'react';
import { Button, FormActions, formatError, formatUsd, Input, SectionHeader } from '@goodboy/ui';
import { parseCap } from '../../../../shared/lib/parse-cap';
import { undoable } from '../../../../shared/utils/undoable';

export type SaveLimitParams = {
  readonly capUsd: number;
  readonly thresholdPct: number;
};

type Props = {
  readonly label: string;
  readonly hint?: string;
  readonly currentCapUsd: number | null;
  readonly currentThresholdPct: number | null;
  readonly onSave: (params: SaveLimitParams) => Promise<void>;
  readonly onRemove: () => Promise<void>;
};

type SyncParams = {
  readonly current: number | null;
  readonly setDraft: (update: (value: string) => string) => void;
};

const DEFAULT_THRESHOLD_PCT = 80;

const textOf = (value: number | null): string => (value === null ? '' : String(value));

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

const useFollowedDraft = ({ current, setDraft }: SyncParams): void => {
  const previousRef = useRef(current);
  useEffect(() => {
    const previousValue = textOf(previousRef.current);
    const nextValue = textOf(current);
    setDraft((value) => (value === previousValue ? nextValue : value));
    previousRef.current = current;
  }, [current, setDraft]);
};

export const CapEditor = ({
  label,
  hint,
  currentCapUsd,
  currentThresholdPct,
  onSave,
  onRemove,
}: Props) => {
  const effectiveThresholdPct = currentThresholdPct ?? DEFAULT_THRESHOLD_PCT;
  const [capDraft, setCapDraft] = useState(textOf(currentCapUsd));
  const [thresholdDraft, setThresholdDraft] = useState(String(effectiveThresholdPct));
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestRef = useRef({ currentCapUsd, onSave });
  useEffect(() => {
    latestRef.current = { currentCapUsd, onSave };
  }, [currentCapUsd, onSave]);
  useFollowedDraft({ current: currentCapUsd, setDraft: setCapDraft });
  useFollowedDraft({ current: effectiveThresholdPct, setDraft: setThresholdDraft });

  const parsedCap = parseCap(capDraft);
  const parsedThreshold = parseThresholdPct(thresholdDraft);
  const isThresholdInvalid = thresholdDraft.trim().length > 0 && parsedThreshold === null;
  const isChanged = parsedCap !== currentCapUsd || parsedThreshold !== effectiveThresholdPct;
  const canSave = parsedCap !== null && parsedThreshold !== null && isChanged && !isBusy;

  const edit = (apply: () => void) => {
    apply();
    setError(null);
  };

  const save = async () => {
    if (parsedCap === null || parsedThreshold === null) {
      return;
    }
    setIsBusy(true);
    try {
      await onSave({ capUsd: parsedCap, thresholdPct: parsedThreshold });
      setError(null);
    } catch (failure) {
      setError(formatError(failure));
    } finally {
      setIsBusy(false);
    }
  };

  const remove = async () => {
    if (currentCapUsd === null) {
      return;
    }
    const previous = { capUsd: currentCapUsd, thresholdPct: effectiveThresholdPct };
    setIsBusy(true);
    try {
      await onRemove();
      setError(null);
      undoable({
        message: `Removed the ${formatUsd(previous.capUsd)} limit`,
        isCurrent: () => latestRef.current.currentCapUsd === null,
        undo: () => latestRef.current.onSave(previous),
      });
    } catch (failure) {
      setError(formatError(failure));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <section className="flex flex-col gap-2">
      <SectionHeader label={label} hint={hint} headingLevel={2} />
      <div className="rounded-lg border border-border-soft bg-subtle p-4">
        <FormActions
          error={error}
          leading={
            <>
              <span className="text-meta text-muted-foreground">Limit</span>
              <span className="flex items-center gap-2">
                <span className="text-body text-muted-foreground">$</span>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={capDraft}
                  placeholder="50"
                  disabled={isBusy}
                  onChange={(event) => edit(() => setCapDraft(event.target.value))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && canSave) {
                      void save();
                    }
                  }}
                  className="w-24 tabular-nums"
                  aria-label={label}
                />
              </span>
              <span className="text-meta text-muted-foreground">Warn at</span>
              <span className="flex items-center gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  value={thresholdDraft}
                  placeholder="80"
                  disabled={isBusy}
                  aria-invalid={isThresholdInvalid}
                  onChange={(event) => edit(() => setThresholdDraft(event.target.value))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && canSave) {
                      void save();
                    }
                  }}
                  className="w-20 tabular-nums"
                  aria-label="Warn at percent of the limit"
                />
                <span className="text-body text-muted-foreground">%</span>
              </span>
            </>
          }
        >
          {currentCapUsd === null ? null : (
            <Button
              variant="ghost"
              size="sm"
              disabled={isBusy}
              className="text-muted-foreground"
              onClick={() => void remove()}
            >
              Remove limit
            </Button>
          )}
          <Button variant="secondary" size="sm" disabled={!canSave} onClick={() => void save()}>
            Save limit
          </Button>
        </FormActions>
      </div>
    </section>
  );
};
