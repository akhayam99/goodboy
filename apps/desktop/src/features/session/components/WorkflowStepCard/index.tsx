import { type ReactNode, useRef } from 'react';
import { GripVertical, Trash2, Wand2 } from 'lucide-react';
import { Input, Textarea, cn } from '@goodboy/ui';
import type { AgentRole, ProviderId } from '@goodboy/types';
import { AGENT_KIND_PALETTE, ROLE_LABEL, ROLE_TO_KIND, type AgentKind } from '../../agent-kind';
import { AgentAvatar } from '../../../../shared/components/AgentAvatar';
import { type VerbosityLevel } from '../../../settings/verbosity';
import {
  type EffortLevel,
  EFFORT_DOT,
  EFFORT_LABEL,
  PROVIDER_LABEL,
  modelLabel,
} from '../../../chat/utils/chat-constants';
import { PROVIDER_BRAND, brandColor } from '../../../providers/components/provider-brand';
import { MODEL_COST_DOT, modelCostTier } from '../dropdown-utils';
import { RoutingPicker } from '../../../../shared/components/RoutingPicker';
import { RoleSelect } from '../RoleSelect';
import { useClickOutside } from '../../../../shared/hooks/useClickOutside';

type Props = {
  readonly ordinal: number;
  readonly kind: AgentKind;
  readonly role: AgentRole;
  readonly provider: ProviderId;
  readonly providerValue: ProviderId | '';
  readonly recommendedProvider: ProviderId;
  readonly candidateProviders: ReadonlyArray<ProviderId>;
  readonly name: string;
  readonly promptPrefix: string;
  readonly expectedOutput?: string;
  readonly model: string;
  readonly resolvedModel: string;
  readonly recommendedModel: string;
  readonly effort: EffortLevel;
  readonly expanded: boolean;
  readonly dragging: boolean;
  readonly disabled: boolean;
  readonly polishing: boolean;
  readonly onExpand: () => void;
  readonly onCollapse: () => void;
  readonly onStartDrag: (e: React.PointerEvent) => void;
  readonly onName: (v: string) => void;
  readonly onPrompt: (v: string) => void;
  readonly onExpectedOutput?: (v: string) => void;
  readonly onModel: (v: string) => void;
  readonly onProvider: (v: ProviderId | '') => void;
  readonly onEffort: (v: EffortLevel) => void;
  readonly onRemove: () => void;
  readonly onMoveUp: () => void;
  readonly onMoveDown: () => void;
  readonly onPolish?: () => void;
  readonly onRole?: (role: AgentRole) => void;
  readonly verbosity?: VerbosityLevel;
  readonly onVerbosity?: (v: VerbosityLevel) => void;
};

const CHIP_CLS =
  'inline-flex items-center gap-1 rounded-md bg-muted/50 px-1.5 py-0.5 text-2xs text-muted-foreground';

const StepMetaRow = ({
  provider,
  resolvedModel,
  effort,
}: {
  readonly provider: ProviderId;
  readonly resolvedModel: string;
  readonly effort: EffortLevel;
}) => {
  const ProviderGlyph = PROVIDER_BRAND[provider].icon;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className={CHIP_CLS}>
        <ProviderGlyph
          size={11}
          className="shrink-0"
          style={{ color: brandColor(provider) }}
          aria-hidden
        />
        {PROVIDER_LABEL[provider]}
      </span>
      <span className={cn(CHIP_CLS, 'font-mono')}>
        <span
          className={cn(
            'size-1.5 shrink-0 rounded-full',
            MODEL_COST_DOT[modelCostTier(resolvedModel)],
          )}
          aria-hidden
        />
        {modelLabel(resolvedModel)}
      </span>
      <span className={CHIP_CLS}>
        <span className={cn('size-1.5 shrink-0 rounded-full', EFFORT_DOT[effort])} aria-hidden />
        {EFFORT_LABEL[effort]}
      </span>
    </span>
  );
};

const FieldLabel = ({ children }: { readonly children: ReactNode }) => (
  <span className="px-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/50">
    {children}
  </span>
);

export const WorkflowStepCard = ({
  ordinal,
  kind,
  role,
  provider,
  providerValue,
  recommendedProvider,
  candidateProviders,
  name,
  promptPrefix,
  expectedOutput,
  model,
  resolvedModel,
  recommendedModel,
  effort,
  expanded,
  dragging,
  disabled,
  polishing,
  onExpand,
  onCollapse,
  onStartDrag,
  onName,
  onPrompt,
  onExpectedOutput,
  onModel,
  onProvider,
  onEffort,
  onRemove,
  onMoveUp,
  onMoveDown,
  onPolish,
  onRole,
  verbosity,
  onVerbosity,
}: Props) => {
  const pal = AGENT_KIND_PALETTE[kind];
  const displayName = name.trim() || ROLE_LABEL[role];
  const liRef = useRef<HTMLLIElement>(null);
  useClickOutside(liRef, () => {
    if (expanded) {
      onCollapse();
    }
  });
  const handleBlur = (e: React.FocusEvent<HTMLLIElement>) => {
    if (!expanded) {
      return;
    }
    const next = e.relatedTarget as Node | null;
    if (next && liRef.current?.contains(next)) {
      return;
    }
    onCollapse();
  };

  const grip = (
    <button
      type="button"
      onPointerDown={onStartDrag}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          onMoveUp();
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          onMoveDown();
          return;
        }
      }}
      disabled={disabled}
      aria-label="reorder step, or use up and down arrow keys"
      title="Drag to reorder (or arrow keys)"
      className="flex shrink-0 cursor-grab touch-none items-center self-stretch rounded-l-lg px-1 text-muted-foreground/30 transition-colors hover:bg-muted/40 hover:text-muted-foreground active:cursor-grabbing disabled:cursor-not-allowed"
    >
      <GripVertical size={14} aria-hidden />
    </button>
  );

  const headerRow = (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className="w-4 shrink-0 text-right font-mono text-2xs tabular-nums text-muted-foreground/40">
        {String(ordinal + 1).padStart(2, '0')}
      </span>
      <AgentAvatar kind={kind} size="sm" />
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span className="min-w-0 truncate text-xs font-medium text-foreground">{displayName}</span>
        {onRole == null ? (
          <span className={cn('shrink-0 text-[10px] font-medium uppercase tracking-wide', pal.fg)}>
            {ROLE_LABEL[role]}
          </span>
        ) : null}
      </span>
    </span>
  );

  const removeButton = (
    <button
      type="button"
      onClick={onRemove}
      disabled={disabled}
      aria-label="remove step"
      title="remove step"
      className="absolute right-1.5 top-1.5 z-10 inline-flex items-center justify-center rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted/60 hover:text-danger focus-visible:opacity-100 disabled:cursor-not-allowed disabled:opacity-30 group-hover:opacity-100"
    >
      <Trash2 size={13} aria-hidden />
    </button>
  );

  return (
    <li
      ref={liRef}
      onBlur={handleBlur}
      className={cn(
        'group relative rounded-lg border motion-safe:transition-colors',
        expanded
          ? 'border-primary/40 bg-primary/[0.03] shadow-sm'
          : 'border-border-soft bg-subtle/40 hover:border-border hover:bg-muted/30',
        dragging && 'opacity-40',
      )}
    >
      {removeButton}

      {!expanded ? (
        <div className="flex items-stretch">
          {grip}
          <button
            type="button"
            onClick={onExpand}
            aria-label={`step ${ordinal + 1}: ${displayName}`}
            className="flex min-w-0 flex-1 flex-col gap-2 py-2.5 pl-1 pr-8 text-left"
          >
            {headerRow}
            <span
              className={cn(
                'line-clamp-2 text-[11px] leading-relaxed',
                promptPrefix.trim() ? 'text-muted-foreground' : 'italic text-muted-foreground/40',
              )}
            >
              {promptPrefix.trim() || 'Click to add instructions'}
            </span>
            <StepMetaRow provider={provider} resolvedModel={resolvedModel} effort={effort} />
          </button>
        </div>
      ) : null}

      {expanded ? (
        <div className="flex items-stretch">
          {grip}
          <div className="flex min-w-0 flex-1 flex-col gap-2.5 py-2.5 pl-1 pr-3">
            {headerRow}
            <Input
              value={name}
              onChange={(e) => onName(e.target.value)}
              placeholder="step name"
              disabled={disabled}
              className={cn('h-7 text-xs font-medium', pal.fg)}
            />
            <div className="relative">
              <Textarea
                value={promptPrefix}
                onChange={(e) => onPrompt(e.target.value)}
                placeholder="role instructions for this step…"
                autoGrow
                minRows={2}
                maxRows={8}
                disabled={disabled}
                className="pr-8 text-[11px] leading-relaxed"
              />
              {onPolish != null ? (
                <button
                  type="button"
                  onClick={onPolish}
                  disabled={disabled || polishing || promptPrefix.trim().length === 0}
                  aria-label="polish step instruction"
                  title="Polish this step's instruction"
                  className={cn(
                    'absolute right-1.5 top-1.5 inline-flex items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40',
                    polishing && 'animate-border-pulse',
                  )}
                >
                  <Wand2 size={12} aria-hidden />
                </button>
              ) : null}
            </div>
            {expectedOutput !== undefined && onExpectedOutput !== undefined ? (
              <div className="flex flex-col gap-1">
                <FieldLabel>Expected output</FieldLabel>
                <Textarea
                  value={expectedOutput}
                  onChange={(e) => onExpectedOutput(e.target.value)}
                  placeholder="what this step hands to the next one…"
                  autoGrow
                  minRows={1}
                  maxRows={4}
                  disabled={disabled}
                  aria-label="expected output"
                  className="text-[11px] leading-relaxed"
                />
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-2.5">
              {onRole != null && (
                <div className="flex flex-col gap-1">
                  <FieldLabel>Role</FieldLabel>
                  <RoleSelect value={role} onChange={onRole} disabled={disabled} />
                </div>
              )}
              <div className="col-span-2 flex flex-col gap-1">
                <FieldLabel>Provider, model, effort</FieldLabel>
                <RoutingPicker
                  ariaLabel={`routing for step ${ordinal + 1}`}
                  providers={candidateProviders}
                  provider={providerValue}
                  model={model}
                  effort={effort}
                  recommendedProvider={recommendedProvider}
                  recommendedModel={recommendedModel}
                  verbosity={verbosity}
                  disabled={disabled}
                  onProvider={onProvider}
                  onModel={onModel}
                  onEffort={onEffort}
                  onVerbosity={onVerbosity}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </li>
  );
};
