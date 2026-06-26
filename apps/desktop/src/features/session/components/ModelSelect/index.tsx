import { useRef, useState } from 'react';
import { cn } from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import { PROVIDER_CAPABILITIES } from '@goodboy/core';
import { Check, ChevronDown, Sparkles } from 'lucide-react';
import { shortModelWithVersion } from '../../agent-row-format';
import { MODEL_COST_DOT, POPUP_BASE, POPUP_DOWN, POPUP_UP, modelCostTier } from '../dropdown-utils';
import { useClickOutside } from '../../../../shared/hooks/useClickOutside';
import { useDropdownDirection } from '../../../../shared/hooks/useDropdownDirection';

type Props = {
  provider: ProviderId;
  value: string;
  onChange: (model: string) => void;
  disabled: boolean;
  allowAuto?: boolean;
  recommendedModel?: string;
};

const AutoTag = () => (
  <span className="shrink-0 rounded bg-muted px-1 text-[9px] font-medium uppercase leading-tight tracking-wide text-muted-foreground/70">
    recommended
  </span>
);

export const ModelSelect = ({
  provider,
  value,
  onChange,
  disabled,
  allowAuto,
  recommendedModel,
}: Props) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpen(false));
  const direction = useDropdownDirection(containerRef, open);

  const models = [...PROVIDER_CAPABILITIES[provider].models].reverse();
  const isAuto = allowAuto === true && value === '';
  const resolved = isAuto && recommendedModel ? recommendedModel : value;
  const tier = modelCostTier(resolved);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={cn(
          'flex w-full items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-xs transition-colors',
          open
            ? 'border-primary bg-primary/5'
            : 'border-border-soft bg-subtle hover:border-border hover:bg-muted/50',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        {isAuto && !recommendedModel ? (
          <Sparkles size={11} className="shrink-0 text-primary" aria-hidden />
        ) : (
          <span
            className={cn('size-1.5 shrink-0 rounded-full', MODEL_COST_DOT[tier])}
            aria-hidden
          />
        )}
        <span className="min-w-0 flex-1 truncate font-mono font-medium text-foreground">
          {isAuto && !recommendedModel ? 'Recommended' : shortModelWithVersion(resolved)}
        </span>
        {isAuto && recommendedModel ? <AutoTag /> : null}
        <ChevronDown
          size={11}
          className={cn(
            'shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          className={cn(POPUP_BASE, 'min-w-[10rem]', direction === 'up' ? POPUP_UP : POPUP_DOWN)}
        >
          {allowAuto === true ? (
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              className={cn(
                'flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-xs font-mono transition-colors',
                isAuto
                  ? 'bg-primary/10 text-foreground'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
            >
              {recommendedModel ? (
                <span
                  className={cn(
                    'size-1.5 shrink-0 rounded-full',
                    MODEL_COST_DOT[modelCostTier(recommendedModel)],
                  )}
                  aria-hidden
                />
              ) : (
                <Sparkles size={11} className="shrink-0 text-primary" aria-hidden />
              )}
              <span className="min-w-0 flex-1 truncate">
                {recommendedModel ? shortModelWithVersion(recommendedModel) : 'Recommended'}
              </span>
              {recommendedModel ? <AutoTag /> : null}
              {isAuto ? <Check size={11} className="shrink-0 text-primary" aria-hidden /> : null}
            </button>
          ) : null}
          {models.map((m) => {
            const active = value === m.id;
            const t = modelCostTier(m.id);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onChange(m.id);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-xs font-mono transition-colors',
                  active
                    ? 'bg-primary/10 text-foreground'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                )}
              >
                <span
                  className={cn('size-1.5 shrink-0 rounded-full', MODEL_COST_DOT[t])}
                  aria-hidden
                />
                <span className="flex-1 truncate">{shortModelWithVersion(m.id)}</span>
                {active ? <Check size={11} className="shrink-0 text-primary" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
