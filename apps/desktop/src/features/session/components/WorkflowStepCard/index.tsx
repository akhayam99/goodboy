import { type ReactNode, useRef } from 'react';
import { GripVertical, Trash2, Wand2 } from 'lucide-react';
import { Input, Textarea, cn } from '@goodboy/ui';
import type { AgentRole, ProviderId } from '@goodboy/types';
import { AGENT_KIND_PALETTE, ROLE_LABEL, ROLE_TO_KIND, type AgentKind } from '../../agent-kind';
import { AgentAvatar } from '../../../../shared/components/AgentAvatar';
import { type VerbosityLevel } from '../../../settings/verbosity';
import { type EffortLevel } from '../../../chat/utils/chat-constants';
import { RoutingBadge } from '../../../../shared/components/RoutingBadge';
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
  readonly connectedProviders: ReadonlyArray<ProviderId>;
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

const FieldLabel = ({ children }: { readonly children: ReactNode }) => (
  <span className="px-0.5 text-3xs font-medium uppercase tracking-wide text-muted-foreground/50">
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
  connectedProviders,
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
    const next = e.relatedTarget;
    if (next == null) {
      return;
    }
    if (next.closest('[data-dropdown-portal]') != null) {
      return;
    }
    if (liRef.current?.contains(next) === true) {
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

  const headerRow = (trailing?: ReactNode) => (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className="w-4 shrink-0 text-right font-mono text-2xs tabular-nums text-muted-foreground">
        {String(ordinal + 1).padStart(2, '0')}
      </span>
      <AgentAvatar kind={kind} size="sm" />
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span className="min-w-0 truncate text-xs font-medium text-foreground">{displayName}</span>
        {onRole == null ? (
          <span className={cn('shrink-0 text-3xs font-medium uppercase tracking-wide', pal.fg)}>
            {ROLE_LABEL[role]}
          </span>
        ) : null}
      </span>
      {trailing}
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
            title="Open this step to edit it"
            className="flex min-w-0 flex-1 flex-col gap-1 py-2 pl-1 pr-8 text-left"
          >
            {headerRow(
              <RoutingBadge
                className="shrink-0"
                glyphPlacement="trailing"
                provider={provider}
                model={resolvedModel}
                effort={effort}
              />,
            )}
            <span
              className={cn(
                'line-clamp-1 pl-[1.625rem] text-2xs leading-relaxed',
                promptPrefix.trim() ? 'text-muted-foreground' : 'italic text-muted-foreground',
              )}
            >
              {promptPrefix.trim() || 'Click to add instructions'}
            </span>
          </button>
        </div>
      ) : null}

      {expanded ? (
        <div className="flex items-stretch">
          {grip}
          <div className="flex min-w-0 flex-1 flex-col gap-2.5 py-2.5 pl-1 pr-3">
            {headerRow()}
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
                className="pr-8 text-2xs leading-relaxed"
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
                  className="text-2xs leading-relaxed"
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
                  connectedProviders={connectedProviders}
                  provider={providerValue}
                  model={model}
                  effort={{ editable: true, value: effort, onChange: onEffort }}
                  recommendation={{ provider: recommendedProvider, model: recommendedModel }}
                  verbosity={verbosity}
                  disabled={disabled}
                  onProvider={onProvider}
                  onModel={onModel}
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
