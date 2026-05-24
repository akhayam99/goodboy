import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import {
  MODEL_CATALOG,
  entryByCliId,
  listEfforts as catalogListEfforts,
  entryByCliId as catalogEntryByCliId,
  type ModelFamily,
  type ModelSubfamily,
} from '@goodboy/core';
import {
  VERBOSITY_LEVELS,
  VERBOSITY_LABEL,
  type VerbosityLevel,
} from '../../../../features/settings/verbosity';
import {
  PROVIDER_LABEL,
  PROVIDER_TEXT,
  type EffortLevel,
  EFFORT_LABEL,
  EFFORT_TEXT,
  FAMILY_SECTION_LABEL,
  TIER_TEXT,
  VERBOSITY_TEXT,
  modelLabel,
  modelTier,
  subfamilyLabel,
  subfamilyTier,
} from '../../utils/chat-constants';
import {
  cliIdFromSelection,
  latestVersionFor,
  nextVersionForCycle,
  pickerGroupsFor,
  selectionFromCliId,
} from '../../utils/model-selection';

const CHIP_ROW = 'flex flex-wrap gap-1 px-2.5 pb-2' as const;
const CHIP_INACTIVE = 'text-muted-foreground hover:bg-muted hover:text-foreground' as const;

export interface ModelPickerProps {
  readonly providers: ReadonlyArray<ProviderId>;
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort: EffortLevel;
  readonly verbosity: VerbosityLevel;
  readonly thinking: boolean;
  readonly fast: boolean;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly disabled: boolean;
  readonly disabledTitle?: string;
  // The workspace/agent default — used for double-click revert.
  readonly defaultModel: string;
  readonly onSelectProvider: (id: ProviderId) => void;
  readonly onSelectModel: (id: string) => void;
  readonly onSelectEffort: (level: EffortLevel) => void;
  readonly onSelectThinking: (value: boolean) => void;
  readonly onSelectFast: (value: boolean) => void;
  readonly onSelectVerbosity: (level: VerbosityLevel) => void;
}

export function ModelPicker({
  providers,
  provider,
  model,
  effort,
  verbosity,
  thinking,
  fast,
  connectedProviders,
  disabled,
  disabledTitle,
  defaultModel,
  onSelectProvider,
  onSelectModel,
  onSelectEffort,
  onSelectThinking,
  onSelectFast,
  onSelectVerbosity,
}: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // Tracks the most recently family-clicked (family, subfamily) so a second
  // click cycles versions instead of re-selecting the latest. Cleared when
  // the picker closes or another family is clicked.
  const cycleStateRef = useRef<{ family: ModelFamily; subfamily: ModelSubfamily } | null>(null);

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

  // Current picker selection derived from the stored cliId. Falls back to a
  // best-effort guess if the cliId is not in the catalog (manual override).
  const selection = useMemo(
    () => selectionFromCliId(provider, model, effort),
    [provider, model, effort],
  );

  const tier = modelTier(model);
  // Compute footer label for the trigger button.
  const currentEntry = catalogEntryByCliId(provider, model);
  const effortsForCurrent = currentEntry
    ? catalogListEfforts(
        provider,
        currentEntry.family,
        currentEntry.subfamily,
        currentEntry.version,
      )
    : null;
  const showEffort =
    effortsForCurrent !== null && effortsForCurrent.length > 0 && provider !== 'cursor';
  // Cursor: effort/thinking/fast are picker controls, but the visible state
  // mirrors the entry's baked-in modifiers (since model id encodes them).
  const cursorEffort = provider === 'cursor' ? (currentEntry?.supportedEfforts?.[0] ?? null) : null;
  const cursorThinking = provider === 'cursor' ? (currentEntry?.supportsThinking ?? false) : false;
  const cursorFast = provider === 'cursor' ? (currentEntry?.supportsFast ?? false) : false;

  // Picker groups (family → subfamilies → versions) for the active provider.
  const groups = useMemo(() => pickerGroupsFor(provider), [provider]);

  // Reusable helper: build the new cliId after the user changes one axis.
  const applySelectionChange = (
    next: Partial<{
      family: ModelFamily;
      subfamily: ModelSubfamily;
      version: string;
      effort: EffortLevel | null;
      thinking: boolean;
      fast: boolean;
    }>,
  ) => {
    if (selection === null) return;
    const merged = { ...selection, ...next };
    const nextCliId = cliIdFromSelection(provider, merged);
    if (nextCliId !== null && nextCliId !== model) onSelectModel(nextCliId);
  };

  const onSubfamilyClick = (family: ModelFamily, subfamily: ModelSubfamily) => {
    if (disabled) return;
    const sameAsBefore =
      cycleStateRef.current?.family === family && cycleStateRef.current?.subfamily === subfamily;
    const target = sameAsBefore
      ? nextVersionForCycle(provider, family, subfamily, selection?.version ?? '')
      : latestVersionFor(provider, family, subfamily);
    if (target === null) return;
    cycleStateRef.current = { family, subfamily };
    applySelectionChange({ family, subfamily, version: target });
  };

  const onSubfamilyDoubleClick = (_family: ModelFamily, _subfamily: ModelSubfamily) => {
    if (disabled) return;
    // Double-click anywhere on a subfamily row reverts to the workspace/agent
    // default — same behavior regardless of which subfamily was clicked.
    cycleStateRef.current = null;
    if (defaultModel !== model) onSelectModel(defaultModel);
  };

  const onVersionPillClick = (family: ModelFamily, subfamily: ModelSubfamily, version: string) => {
    if (disabled) return;
    cycleStateRef.current = { family, subfamily };
    applySelectionChange({ family, subfamily, version });
  };

  const onEffortClick = (level: EffortLevel) => {
    if (provider === 'cursor') {
      applySelectionChange({ effort: level });
    } else {
      onSelectEffort(level);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => {
          if (disabled) return;
          if (!open) cycleStateRef.current = null; // fresh open → fresh cycle state
          setOpen((v) => !v);
        }}
        disabled={disabled}
        title={
          disabled
            ? disabledTitle
            : `Sending to ${PROVIDER_LABEL[provider]} · ${modelLabel(model)}${showEffort ? ` · ${EFFORT_LABEL[effort]} effort` : ''} · ${VERBOSITY_LABEL[verbosity]} replies. Click to change.`
        }
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
        {provider === 'cursor' && cursorEffort !== null ? (
          <>
            <span aria-hidden className="text-muted-foreground/70">
              ·
            </span>
            <span className={EFFORT_TEXT[cursorEffort]}>{EFFORT_LABEL[cursorEffort]}</span>
          </>
        ) : null}
        {provider === 'cursor' && cursorThinking ? (
          <span className="text-info" title="extended thinking enabled">
            ·thinking
          </span>
        ) : null}
        {provider === 'cursor' && cursorFast ? (
          <span className="text-warning" title="fast sampling (premium)">
            ·fast
          </span>
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
          className="absolute bottom-full right-0 z-30 mb-1.5 w-72 overflow-hidden rounded-lg bg-subtle py-2 text-xs shadow-lg ring-1 ring-border-soft"
        >
          {/* Provider */}
          <PickerSection label="Provider" hint="Which CLI agent runs your turns">
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

          {/* Models grouped by family → subfamily → version pills */}
          {groups.map((group) => {
            const sectionLabel = FAMILY_SECTION_LABEL[group.family] ?? group.family;
            return (
              <PickerSection key={group.family} label={sectionLabel}>
                {group.subfamilies.map(({ subfamily, versions }) => {
                  if (versions.length === 0) return null;
                  return (
                    <SubfamilyVersionRow
                      key={subfamily}
                      family={group.family}
                      subfamily={subfamily}
                      versions={versions}
                      selectedVersion={selection?.version ?? null}
                      selectedFamily={selection?.family ?? null}
                      selectedSubfamily={selection?.subfamily ?? null}
                      onSubfamilyClick={onSubfamilyClick}
                      onSubfamilyDoubleClick={onSubfamilyDoubleClick}
                      onVersionPillClick={onVersionPillClick}
                    />
                  );
                })}
              </PickerSection>
            );
          })}
          <PickerDivider />

          {/* Effort — always visible. Cursor mirrors the embedded-effort selection. */}
          <PickerSection label="Effort" hint="How hard the model thinks before answering">
            {(() => {
              const efforts = currentEntry
                ? catalogListEfforts(
                    provider,
                    currentEntry.family,
                    currentEntry.subfamily,
                    currentEntry.version,
                  )
                : null;
              const activeEffort = provider === 'cursor' ? cursorEffort : effort;
              if (efforts === null || efforts.length === 0) {
                return (
                  <p className="px-2.5 pb-2 text-2xs italic text-muted-foreground/50">
                    not available for this model
                  </p>
                );
              }
              return (
                <div className={CHIP_ROW}>
                  {efforts.map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => onEffortClick(level)}
                      className={cn(
                        'rounded px-2 py-0.5 transition-colors',
                        activeEffort === level
                          ? cn('bg-muted font-semibold', EFFORT_TEXT[level])
                          : CHIP_INACTIVE,
                      )}
                    >
                      {EFFORT_LABEL[level]}
                    </button>
                  ))}
                </div>
              );
            })()}
          </PickerSection>

          {/* Cursor-only: thinking + fast modifier rows. */}
          {provider === 'cursor' &&
          currentEntry &&
          (modelSupportsThinking(
            provider,
            currentEntry.family,
            currentEntry.subfamily,
            currentEntry.version,
          ) ||
            modelSupportsFast(
              provider,
              currentEntry.family,
              currentEntry.subfamily,
              currentEntry.version,
            )) ? (
            <>
              <PickerDivider />
              <PickerSection
                label="Modifiers"
                hint="Cursor-only: extended thinking + fast sampling"
              >
                <div className={CHIP_ROW}>
                  {modelSupportsThinking(
                    provider,
                    currentEntry.family,
                    currentEntry.subfamily,
                    currentEntry.version,
                  ) ? (
                    <button
                      type="button"
                      onClick={() => {
                        const next = !cursorThinking;
                        applySelectionChange({ thinking: next });
                        onSelectThinking(next);
                      }}
                      className={cn(
                        'rounded px-2 py-0.5 transition-colors',
                        cursorThinking ? 'bg-muted font-semibold text-info' : CHIP_INACTIVE,
                      )}
                    >
                      thinking
                    </button>
                  ) : null}
                  {modelSupportsFast(
                    provider,
                    currentEntry.family,
                    currentEntry.subfamily,
                    currentEntry.version,
                  ) ? (
                    <button
                      type="button"
                      onClick={() => {
                        const next = !cursorFast;
                        applySelectionChange({ fast: next });
                        onSelectFast(next);
                      }}
                      className={cn(
                        'rounded px-2 py-0.5 transition-colors',
                        cursorFast ? 'bg-muted font-semibold text-warning' : CHIP_INACTIVE,
                      )}
                      title="6× pricing — research preview"
                    >
                      fast
                    </button>
                  ) : null}
                </div>
              </PickerSection>
            </>
          ) : null}
          <PickerDivider />

          {/* Verbosity */}
          <PickerSection label="Verbosity" hint="How detailed the replies should be">
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

function modelSupportsThinking(
  provider: ProviderId,
  family: ModelFamily,
  subfamily: ModelSubfamily,
  version: string,
): boolean {
  if (provider !== 'cursor') return false;
  // Any entry in this (family, subfamily, version) with supportsThinking=true
  // → toggle is exposed.
  return CURSOR_HAS_MODIFIER(family, subfamily, version, 'thinking');
}

function modelSupportsFast(
  provider: ProviderId,
  family: ModelFamily,
  subfamily: ModelSubfamily,
  version: string,
): boolean {
  if (provider !== 'cursor') return false;
  return CURSOR_HAS_MODIFIER(family, subfamily, version, 'fast');
}

// Cross-checks the live catalog for whether ANY entry in (family, subfamily,
// version) exposes the requested modifier — i.e. should the picker even
// render the toggle? Used by `modelSupportsThinking` / `modelSupportsFast`.
function CURSOR_HAS_MODIFIER(
  family: ModelFamily,
  subfamily: ModelSubfamily,
  version: string,
  modifier: 'thinking' | 'fast',
): boolean {
  return MODEL_CATALOG.cursor.some(
    (e) =>
      e.family === family &&
      e.subfamily === subfamily &&
      e.version === version &&
      (modifier === 'thinking' ? e.supportsThinking : e.supportsFast),
  );
}

function PickerSection({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-0.5 px-2.5 pb-1 pt-1.5">
        <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground/80">
          {label}
        </span>
        {hint ? (
          <span className="text-[10px] leading-tight text-muted-foreground/60">{hint}</span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function PickerDivider() {
  return <div className="my-1 h-px bg-border-soft" aria-hidden />;
}

function SubfamilyVersionRow({
  family,
  subfamily,
  versions,
  selectedVersion,
  selectedFamily,
  selectedSubfamily,
  onSubfamilyClick,
  onSubfamilyDoubleClick,
  onVersionPillClick,
}: {
  family: ModelFamily;
  subfamily: ModelSubfamily;
  versions: ReadonlyArray<string>;
  selectedVersion: string | null;
  selectedFamily: ModelFamily | null;
  selectedSubfamily: ModelSubfamily | null;
  onSubfamilyClick: (family: ModelFamily, subfamily: ModelSubfamily) => void;
  onSubfamilyDoubleClick: (family: ModelFamily, subfamily: ModelSubfamily) => void;
  onVersionPillClick: (family: ModelFamily, subfamily: ModelSubfamily, version: string) => void;
}) {
  const tier = subfamilyTier(family, subfamily);
  const isActiveRow = selectedFamily === family && selectedSubfamily === subfamily;
  return (
    <div className="flex items-center px-2.5 py-1.5 hover:bg-muted/60">
      <button
        type="button"
        onClick={() => onSubfamilyClick(family, subfamily)}
        onDoubleClick={() => onSubfamilyDoubleClick(family, subfamily)}
        title={`click: latest · re-click: cycle · double-click: revert default`}
        className={cn('flex-1 text-left text-xs', TIER_TEXT[tier], 'hover:font-medium')}
      >
        {subfamilyLabel(family, subfamily)}
      </button>
      <div className="flex flex-wrap gap-1">
        {versions.map((v) => {
          const selected = isActiveRow && selectedVersion === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onVersionPillClick(family, subfamily, v)}
              className={cn(
                'rounded px-1.5 py-0.5 font-mono text-[10px] transition-colors',
                selected ? cn('bg-muted font-semibold', TIER_TEXT[tier]) : CHIP_INACTIVE,
              )}
            >
              {v}
            </button>
          );
        })}
      </div>
    </div>
  );
}
