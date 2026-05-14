import { useEffect, useRef } from 'react';
import { cn } from '@kay-am/ui';
import { modelLabel, modelTier, TIER_TEXT } from './chat-constants';

export interface RightSizeCardProps {
  readonly currentModel: string;
  readonly suggestedModel: string;
  readonly onUseSuggested: () => void;
  readonly onKeepCurrent: () => void;
  readonly onChangeModel: () => void;
}

export function RightSizeCard({
  currentModel,
  suggestedModel,
  onUseSuggested,
  onKeepCurrent,
  onChangeModel,
}: RightSizeCardProps) {
  const suggestBtnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    suggestBtnRef.current?.focus();
  }, []);

  return (
    <section
      className="rounded border border-info/40 bg-info/10 px-2.5 py-2 text-[11px]"
      data-testid="right-size-card"
      aria-label="model right-sizing suggestion"
    >
      <p className="mb-2 text-foreground">
        This looks light. Run with{' '}
        <span className={cn('font-semibold', TIER_TEXT[modelTier(suggestedModel)])}>
          {modelLabel(suggestedModel)}
        </span>{' '}
        instead of{' '}
        <span className={cn('font-semibold', TIER_TEXT[modelTier(currentModel)])}>
          {modelLabel(currentModel)}
        </span>
        ?
      </p>
      <div className="flex gap-2">
        <button
          ref={suggestBtnRef}
          type="button"
          onClick={onUseSuggested}
          className="rounded bg-info px-2 py-0.5 text-[10px] font-semibold text-info-foreground hover:opacity-90"
          data-testid="right-size-use-suggested"
        >
          Use {modelLabel(suggestedModel)}
        </button>
        <button
          type="button"
          onClick={onKeepCurrent}
          className="rounded border border-border px-2 py-0.5 text-[10px] font-semibold text-foreground hover:bg-muted"
          data-testid="right-size-keep-current"
        >
          Keep {modelLabel(currentModel)}
        </button>
        <button
          type="button"
          onClick={onChangeModel}
          className="rounded border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
          data-testid="right-size-change-model"
        >
          Change model…
        </button>
      </div>
    </section>
  );
}
