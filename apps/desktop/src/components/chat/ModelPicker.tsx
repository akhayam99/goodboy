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
  FAMILY_SECTION_LABEL,
  type ModelFamily,
  TIER_TEXT,
  VERBOSITY_DOT,
  VERBOSITY_TEXT,
  modelLabel,
  modelTier,
  modelWeight,
  modelEffortLevels,
  parseModelId,
  subfamilyLabel,
  subfamilyTier,
} from './chat-constants';

const CHIP_ROW = 'flex flex-wrap gap-1 px-2.5 pb-2' as const;
const CHIP_INACTIVE = 'text-muted-foreground hover:bg-muted hover:text-foreground' as const;

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

  // Two-level grouping: family → (subfamily ?? null) → ids. Subfamily=null
  // means "render as a flat chip row under the family label" (composer,
  // cursor-auto). Subfamily set means "render as a FamilyVersionRow" with
  // a subfamily label and version chips.
  const groupedModels = useMemo(() => {
    const sorted = [...models].sort((a, b) => modelWeight(a) - modelWeight(b));
    const byFamily = new Map<ModelFamily, Map<string | null, string[]>>();
    for (const id of sorted) {
      const parsed = parseModelId(id);
      let subMap = byFamily.get(parsed.family);
      if (!subMap) {
        subMap = new Map();
        byFamily.set(parsed.family, subMap);
      }
      const key = parsed.subfamily;
      const arr = subMap.get(key) ?? [];
      arr.push(id);
      subMap.set(key, arr);
    }
    return byFamily;
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
            <div className={CHIP_ROW}>
              {providers.map((id) => {
                const isConnected = connectedProviders.includes(id);
                const active = provider === id;
                const chipTone = (() => {
                  if (active) return cn('bg-muted font-semibold', PROVIDER_TEXT[id]);
                  if (isConnected) return CHIP_INACTIVE;
                  return 'text-muted-foreground/35 hover:bg-muted/50';
                })();
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onSelectProvider(id)}
                    title={isConnected ? undefined : 'not connected'}
                    className={cn('rounded-full px-2.5 py-0.5 transition-colors', chipTone)}
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

          {/* Model — family/subfamily/variant chip layout. */}
          {[...groupedModels.entries()].map(([fam, subMap]) => {
            const subKeys = [...subMap.keys()];
            const onlyFlat = subKeys.length === 1 && subKeys[0] === null;
            const sectionLabel = FAMILY_SECTION_LABEL[fam] ?? fam;

            if (onlyFlat) {
              const ids = subMap.get(null) ?? [];
              return (
                <PickerSection key={fam} label={sectionLabel}>
                  <FlatVariantRow
                    family={fam}
                    ids={ids}
                    selectedModel={model}
                    onSelect={onSelectModel}
                  />
                </PickerSection>
              );
            }

            return (
              <PickerSection key={fam} label={sectionLabel}>
                {[...subMap.entries()].map(([sub, ids]) => {
                  if (sub === null) {
                    return (
                      <FlatVariantRow
                        key="_flat"
                        family={fam}
                        ids={ids}
                        selectedModel={model}
                        onSelect={onSelectModel}
                      />
                    );
                  }
                  return (
                    <SubfamilyVariantRow
                      key={sub}
                      family={fam}
                      subfamily={sub}
                      ids={ids}
                      selectedModel={model}
                      onSelect={onSelectModel}
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
              <div className={CHIP_ROW}>
                {effortLevels.map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => onSelectEffort(level)}
                    className={cn(
                      'rounded px-2 py-0.5 transition-colors',
                      effort === level
                        ? cn('bg-muted font-semibold', EFFORT_TEXT[level])
                        : CHIP_INACTIVE,
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
            <div className={CHIP_ROW}>
              {VERBOSITY_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => onSelectVerbosity(level)}
                  className={cn(
                    'rounded px-2 py-0.5 transition-colors',
                    verbosity === level
                      ? cn('bg-muted font-semibold', VERBOSITY_TEXT[level])
                      : CHIP_INACTIVE,
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

function SubfamilyVariantRow({
  family,
  subfamily,
  ids,
  selectedModel,
  onSelect,
}: {
  family: ModelFamily;
  subfamily: string;
  ids: string[];
  selectedModel: string;
  onSelect: (id: string) => void;
}) {
  const tier = subfamilyTier(family, subfamily);
  return (
    <div className="flex items-center px-2.5 py-1.5 hover:bg-muted/60">
      <span className={cn('flex-1 text-xs', TIER_TEXT[tier])}>
        {subfamilyLabel(family, subfamily)}
      </span>
      <div className="flex flex-wrap gap-1">
        {ids.map((id) => {
          const selected = selectedModel === id;
          const t = modelTier(id);
          const chip = parseModelId(id).variantLabel;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              title={id}
              className={cn(
                'rounded px-1.5 py-0.5 font-mono text-[10px] transition-colors',
                selected ? cn('bg-muted font-semibold', TIER_TEXT[t]) : CHIP_INACTIVE,
              )}
            >
              {chip}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FlatVariantRow({
  family: _family,
  ids,
  selectedModel,
  onSelect,
}: {
  family: ModelFamily;
  ids: string[];
  selectedModel: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className={CHIP_ROW}>
      {ids.map((id) => {
        const selected = selectedModel === id;
        const t = modelTier(id);
        const chip = parseModelId(id).variantLabel;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            title={id}
            className={cn(
              'rounded-full px-2.5 py-0.5 text-xs transition-colors',
              selected ? cn('bg-muted font-semibold', TIER_TEXT[t]) : CHIP_INACTIVE,
            )}
          >
            {chip}
          </button>
        );
      })}
    </div>
  );
}
