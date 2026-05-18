import { useEffect, useRef, useState } from 'react';
import { cn } from '@kay-am/ui';
import type { ProviderId } from '@kay-am/types';
import { PROVIDER_CAPABILITIES } from '@kay-am/core';
import { Check, ChevronDown } from 'lucide-react';
import { shortModelWithVersion } from '../agent-row-format';
import {
  EFFORT_DOT,
  EFFORT_LABEL,
  type EffortLevel,
  modelEffortLevels,
} from '../../chat/utils/chat-constants';
import { VERBOSITY_LABEL, VERBOSITY_LEVELS, type VerbosityLevel } from '../../settings/verbosity';

export { type EffortLevel, modelEffortLevels };
export { type VerbosityLevel };

export function InlineField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground/70">
        {label}
      </span>
      {children}
    </div>
  );
}

const MODEL_COST_DOT: Record<string, string> = {
  cheap: 'bg-emerald-400',
  mid: 'bg-amber-400',
  premium: 'bg-rose-400',
};

const VERBOSITY_DOT: Record<VerbosityLevel, string> = {
  brief: 'bg-emerald-400',
  normal: 'bg-amber-400',
  verbose: 'bg-rose-400',
};

function modelCostTier(modelId: string): 'cheap' | 'mid' | 'premium' {
  if (/haiku|mini|fast/i.test(modelId)) return 'cheap';
  if (/opus/i.test(modelId)) return 'premium';
  return 'mid';
}

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, onClose]);
}

export function ModelSelect({
  provider,
  value,
  onChange,
  disabled,
}: {
  provider: ProviderId;
  value: string;
  onChange: (model: string) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpen(false));

  const models = [...PROVIDER_CAPABILITIES[provider].models].reverse();
  const tier = modelCostTier(value);

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
        <span className={cn('size-1.5 shrink-0 rounded-full', MODEL_COST_DOT[tier])} aria-hidden />
        <span className="flex-1 truncate font-mono font-medium text-foreground">
          {shortModelWithVersion(value)}
        </span>
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
        <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[10rem] rounded-md border border-border bg-background py-0.5 shadow-lg">
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
}

export function EffortSelect({
  model,
  value,
  onChange,
  disabled,
}: {
  model: string;
  value: EffortLevel;
  onChange: (level: EffortLevel) => void;
  disabled: boolean;
}) {
  const levels = modelEffortLevels(model);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpen(false));

  if (!levels) {
    return (
      <div className="flex h-[34px] items-center rounded-md border border-border-soft/50 bg-subtle/50 px-2 text-xs text-muted-foreground/40">
        N/A
      </div>
    );
  }

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
        <span className={cn('size-1.5 shrink-0 rounded-full', EFFORT_DOT[value])} aria-hidden />
        <span className="flex-1 truncate font-medium text-foreground">{EFFORT_LABEL[value]}</span>
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
        <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[8rem] rounded-md border border-border bg-background py-0.5 shadow-lg">
          {levels.map((level) => {
            const active = value === level;
            return (
              <button
                key={level}
                type="button"
                onClick={() => {
                  onChange(level);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-xs transition-colors',
                  active
                    ? 'bg-primary/10 text-foreground'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                )}
              >
                <span
                  className={cn('size-1.5 shrink-0 rounded-full', EFFORT_DOT[level])}
                  aria-hidden
                />
                <span className="flex-1">{EFFORT_LABEL[level]}</span>
                {active ? <Check size={11} className="shrink-0 text-primary" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function VerbositySelect({
  value,
  onChange,
  disabled,
}: {
  value: VerbosityLevel;
  onChange: (level: VerbosityLevel) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpen(false));

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
        <span className={cn('size-1.5 shrink-0 rounded-full', VERBOSITY_DOT[value])} aria-hidden />
        <span className="flex-1 truncate font-medium text-foreground">
          {VERBOSITY_LABEL[value]}
        </span>
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
        <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[7rem] rounded-md border border-border bg-background py-0.5 shadow-lg">
          {VERBOSITY_LEVELS.map((level) => {
            const active = value === level;
            return (
              <button
                key={level}
                type="button"
                onClick={() => {
                  onChange(level);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-xs transition-colors',
                  active
                    ? 'bg-primary/10 text-foreground'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                )}
              >
                <span
                  className={cn('size-1.5 shrink-0 rounded-full', VERBOSITY_DOT[level])}
                  aria-hidden
                />
                <span className="flex-1">{VERBOSITY_LABEL[level]}</span>
                {active ? <Check size={11} className="shrink-0 text-primary" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
