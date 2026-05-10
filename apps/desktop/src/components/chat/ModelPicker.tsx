import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@kay-am/ui';
import type { ProviderId } from '@kay-am/types';
import { VERBOSITY_LEVELS, VERBOSITY_LABEL, type VerbosityLevel } from '../../verbosity';
import {
  PROVIDER_LABEL,
  PROVIDER_TEXT,
  EFFORT_LEVELS,
  type EffortLevel,
  EFFORT_LABEL,
  EFFORT_DOT,
  EFFORT_TEXT,
  FAMILY_LABEL,
  TIER_TEXT,
  TIER_DOT,
  VERBOSITY_DOT,
  VERBOSITY_TEXT,
  modelLabel,
  modelFamily,
  modelTier,
  modelWeight,
} from './chat-constants';

export interface ModelPickerProps {
  readonly providers: ReadonlyArray<ProviderId>;
  readonly models: ReadonlyArray<string>;
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort: EffortLevel;
  readonly verbosity: VerbosityLevel;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly disabled: boolean;
  readonly disabledTitle?: string;
  readonly onSelectProvider: (id: ProviderId) => void;
  readonly onSelectModel: (id: string) => void;
  readonly onSelectEffort: (level: EffortLevel) => void;
  readonly onSelectVerbosity: (level: VerbosityLevel) => void;
}

export function ModelPicker({
  providers,
  models,
  provider,
  model,
  effort,
  verbosity,
  connectedProviders,
  disabled,
  disabledTitle,
  onSelectProvider,
  onSelectModel,
  onSelectEffort,
  onSelectVerbosity,
}: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const showEffort = provider === 'anthropic';
  const tier = modelTier(model);

  const groupedModels = useMemo(() => {
    const sorted = [...models].sort((a, b) => modelWeight(a) - modelWeight(b));
    const groups = new Map<string, string[]>();
    for (const id of sorted) {
      const fam = modelFamily(id);
      let arr = groups.get(fam);
      if (!arr) {
        arr = [];
        groups.set(fam, arr);
      }
      arr.push(id);
    }
    return groups;
  }, [models]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        title={disabled ? disabledTitle : 'choose provider · model · effort'}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full bg-subtle px-2.5 py-0.5 text-xs transition-colors hover:bg-muted',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <span className={cn('font-medium', PROVIDER_TEXT[provider])}>
          {PROVIDER_LABEL[provider]}
        </span>
        <span aria-hidden className="text-muted-foreground/70">
          ·
        </span>
        <span className={cn('font-medium', TIER_TEXT[tier])}>{modelLabel(model)}</span>
        {showEffort ? (
          <>
            <span aria-hidden className="text-muted-foreground/70">
              ·
            </span>
            <span className={EFFORT_TEXT[effort]}>{EFFORT_LABEL[effort].toLowerCase()}</span>
          </>
        ) : null}
        <span aria-hidden className="text-muted-foreground/70">
          ·
        </span>
        <span
          className={VERBOSITY_TEXT[verbosity]}
          title={`verbosity: ${VERBOSITY_LABEL[verbosity].toLowerCase()}`}
        >
          v:{VERBOSITY_LABEL[verbosity].toLowerCase()}
        </span>
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="model & effort"
          className="absolute bottom-full right-0 z-30 mb-1.5 w-64 overflow-hidden rounded-lg bg-background py-1.5 text-xs shadow-lg ring-1 ring-border-soft"
        >
          <PickerSection label="provider">
            {providers.map((id) => {
              const isConnected = connectedProviders.includes(id);
              return (
                <PickerRow
                  key={id}
                  label={PROVIDER_LABEL[id]}
                  active={provider === id}
                  onClick={() => onSelectProvider(id)}
                  labelClassName={isConnected ? PROVIDER_TEXT[id] : 'text-muted-foreground/60'}
                  trailing={
                    !isConnected ? (
                      <span className="text-2xs text-warning">connect ↗</span>
                    ) : undefined
                  }
                />
              );
            })}
          </PickerSection>
          <PickerDivider />
          {groupedModels.size <= 1 ? (
            <PickerSection label="model · cheapest first">
              {[...groupedModels.values()].flat().map((id) => {
                const t = modelTier(id);
                return (
                  <PickerRow
                    key={id}
                    label={modelLabel(id)}
                    active={model === id}
                    onClick={() => onSelectModel(id)}
                    leadingDot={TIER_DOT[t]}
                    labelClassName={TIER_TEXT[t]}
                  />
                );
              })}
            </PickerSection>
          ) : (
            [...groupedModels.entries()].map(([fam, ids]) => (
              <PickerSection key={fam} label={FAMILY_LABEL[fam] ?? fam}>
                {ids.map((id) => {
                  const t = modelTier(id);
                  return (
                    <PickerRow
                      key={id}
                      label={modelLabel(id)}
                      active={model === id}
                      onClick={() => onSelectModel(id)}
                      leadingDot={TIER_DOT[t]}
                      labelClassName={TIER_TEXT[t]}
                    />
                  );
                })}
              </PickerSection>
            ))
          )}
          {showEffort ? (
            <>
              <PickerDivider />
              <PickerSection label="effort">
                {EFFORT_LEVELS.map((level) => (
                  <PickerRow
                    key={level}
                    label={EFFORT_LABEL[level]}
                    leadingDot={EFFORT_DOT[level]}
                    active={effort === level}
                    onClick={() => onSelectEffort(level)}
                    labelClassName={EFFORT_TEXT[level]}
                  />
                ))}
              </PickerSection>
            </>
          ) : null}
          <PickerDivider />
          <PickerSection label="verbosity · cheaper first">
            {VERBOSITY_LEVELS.map((level) => (
              <PickerRow
                key={level}
                label={VERBOSITY_LABEL[level]}
                leadingDot={VERBOSITY_DOT[level]}
                active={verbosity === level}
                onClick={() => onSelectVerbosity(level)}
                labelClassName={VERBOSITY_TEXT[level]}
              />
            ))}
          </PickerSection>
        </div>
      ) : null}
    </div>
  );
}

function PickerSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <div className="px-2.5 pb-0.5 pt-1 text-2xs uppercase tracking-wide text-muted-foreground/70">
        {label}
      </div>
      {children}
    </div>
  );
}

function PickerDivider() {
  return <div className="my-1 h-px bg-border-soft" aria-hidden />;
}

function PickerRow({
  label,
  active,
  onClick,
  leadingDot,
  labelClassName,
  trailing,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  leadingDot?: string;
  labelClassName?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-muted',
        active ? '' : 'opacity-80',
      )}
    >
      {leadingDot ? (
        <span aria-hidden className={cn('inline-block h-1.5 w-1.5 rounded-full', leadingDot)} />
      ) : null}
      <span className={cn('flex-1 truncate', labelClassName ?? 'text-muted-foreground')}>
        {label}
      </span>
      {trailing}
      {active ? (
        <span aria-hidden className="text-2xs text-primary">
          ✓
        </span>
      ) : null}
    </button>
  );
}
