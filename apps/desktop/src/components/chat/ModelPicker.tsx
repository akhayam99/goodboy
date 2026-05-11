import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@kay-am/ui';
import type { ProviderId } from '@kay-am/types';
import { VERBOSITY_LEVELS, VERBOSITY_LABEL, type VerbosityLevel } from '../../verbosity';
import {
  PROVIDER_LABEL,
  PROVIDER_TEXT,
  type EffortLevel,
  EFFORT_LABEL,
  EFFORT_DOT,
  EFFORT_TEXT,
  FAMILY_LABEL,
  TIER_TEXT,
  TIER_DOT,
  VERBOSITY_DOT,
  VERBOSITY_TEXT,
  CLAUDE_SUBFAMILY_LABEL,
  CLAUDE_SUBFAMILY_TIER,
  modelLabel,
  modelFamily,
  modelSubfamily,
  modelVersion,
  modelTier,
  modelWeight,
  modelEffortLevels,
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

  const effortLevels = modelEffortLevels(model);
  const showEffort = provider === 'anthropic' && effortLevels !== null;
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
            <span className={EFFORT_TEXT[effort]}>{EFFORT_LABEL[effort]}</span>
          </>
        ) : null}
        <span aria-hidden className="text-muted-foreground/70">
          ·
        </span>
        <span
          className={VERBOSITY_TEXT[verbosity]}
          title={`verbosity: ${VERBOSITY_LABEL[verbosity]}`}
        >
          {VERBOSITY_LABEL[verbosity]}
        </span>
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="model picker"
          className="absolute bottom-full right-0 z-30 mb-1.5 w-64 overflow-hidden rounded-lg bg-background py-2 text-xs shadow-lg ring-1 ring-border-soft"
        >
          {/* Provider */}
          <PickerSection label="Provider">
            <div className="flex flex-wrap gap-1 px-2.5 pb-2">
              {providers.map((id) => {
                const isConnected = connectedProviders.includes(id);
                const active = provider === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onSelectProvider(id)}
                    title={isConnected ? undefined : 'not connected'}
                    className={cn(
                      'rounded-full px-2.5 py-0.5 transition-colors',
                      active
                        ? cn('bg-muted font-semibold', PROVIDER_TEXT[id])
                        : isConnected
                          ? 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          : 'text-muted-foreground/35 hover:bg-muted/50',
                    )}
                  >
                    {PROVIDER_LABEL[id]}
                    {!isConnected ? (
                      <span className="ml-0.5 text-[9px] text-warning">↗</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </PickerSection>
          <PickerDivider />

          {/* Model — family rows with version chips */}
          {[...groupedModels.entries()].map(([fam, ids]) => {
            const sectionLabel = groupedModels.size > 1 ? (FAMILY_LABEL[fam] ?? fam) : 'Model';
            if (fam === 'claude') {
              const subMap = new Map<string, string[]>();
              for (const id of ids) {
                const sub = modelSubfamily(id);
                const arr = subMap.get(sub) ?? [];
                arr.push(id);
                subMap.set(sub, arr);
              }
              return (
                <PickerSection key={fam} label={sectionLabel}>
                  {[...subMap.entries()].map(([sub, subIds]) => (
                    <FamilyVersionRow
                      key={sub}
                      subfamily={sub}
                      ids={subIds}
                      selectedModel={model}
                      onSelect={onSelectModel}
                    />
                  ))}
                </PickerSection>
              );
            }
            return (
              <PickerSection key={fam} label={sectionLabel}>
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
            );
          })}
          <PickerDivider />

          {/* Effort — always visible */}
          <PickerSection label="Effort">
            {showEffort && effortLevels ? (
              <div className="flex flex-wrap gap-1 px-2.5 pb-2">
                {effortLevels.map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => onSelectEffort(level)}
                    className={cn(
                      'rounded px-2 py-0.5 transition-colors',
                      effort === level
                        ? cn('bg-muted font-semibold', EFFORT_TEXT[level])
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    {EFFORT_LABEL[level]}
                  </button>
                ))}
              </div>
            ) : (
              <p className="px-2.5 pb-2 text-2xs italic text-muted-foreground/50">
                not available for this model
              </p>
            )}
          </PickerSection>
          <PickerDivider />

          {/* Verbosity */}
          <PickerSection label="Verbosity">
            <div className="flex flex-wrap gap-1 px-2.5 pb-2">
              {VERBOSITY_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => onSelectVerbosity(level)}
                  className={cn(
                    'rounded px-2 py-0.5 transition-colors',
                    verbosity === level
                      ? cn('bg-muted font-semibold', VERBOSITY_TEXT[level])
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {VERBOSITY_LABEL[level]}
                </button>
              ))}
            </div>
          </PickerSection>
        </div>
      ) : null}
    </div>
  );
}

function PickerSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <div className="px-2.5 pb-0.5 pt-1 text-2xs tracking-wide text-muted-foreground/70">
        {label}
      </div>
      {children}
    </div>
  );
}

function PickerDivider() {
  return <div className="my-1 h-px bg-border-soft" aria-hidden />;
}

function FamilyVersionRow({
  subfamily,
  ids,
  selectedModel,
  onSelect,
}: {
  subfamily: string;
  ids: string[];
  selectedModel: string;
  onSelect: (id: string) => void;
}) {
  const tier = CLAUDE_SUBFAMILY_TIER[subfamily] ?? 'mid';
  return (
    <div className="flex items-center px-2.5 py-1.5 hover:bg-muted/60">
      <span className={cn('flex-1 text-xs', TIER_TEXT[tier])}>
        {CLAUDE_SUBFAMILY_LABEL[subfamily] ?? subfamily}
      </span>
      <div className="flex gap-1">
        {ids.map((id) => {
          const selected = selectedModel === id;
          const t = modelTier(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              title={modelLabel(id)}
              className={cn(
                'rounded px-1.5 py-0.5 font-mono text-[10px] transition-colors',
                selected
                  ? cn('bg-muted font-semibold', TIER_TEXT[t])
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {modelVersion(id)}
            </button>
          );
        })}
      </div>
    </div>
  );
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
