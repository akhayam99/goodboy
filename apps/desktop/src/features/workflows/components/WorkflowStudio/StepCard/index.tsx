import { Input, Textarea, cn } from '@goodboy/ui';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { getDefaultTurnModel } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';
import type { DefinitionForm } from '../../WorkflowsPanel';
import { AGENT_KIND_PALETTE, ROLE_LABEL, ROLE_TO_KIND } from '../../../../session/agent-kind';
import { AgentAvatar } from '../../../../../shared/components/AgentAvatar';
import { shortModel } from '../../../../session/agent-row-format';
import { modelEffortLevels } from '../../../../chat/utils/chat-constants';
import { RoleSelect } from '../../../../session/components/RoleSelect';
import { InlineField } from '../../../../session/components/InlineField';
import { ModelSelect } from '../../../../session/components/ModelSelect';
import { EffortSelect } from '../../../../session/components/EffortSelect';
import { VerbositySelect } from '../../../../session/components/VerbositySelect';
import { ProviderSelect } from '../../../../session/components/ProviderSelect';

interface Props {
  readonly def: DefinitionForm;
  readonly ordinal: number;
  readonly total: number;
  readonly expanded: boolean;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly onToggleExpand: () => void;
  readonly onUpdate: (patch: Partial<DefinitionForm>) => void;
  readonly onRemove: () => void;
  readonly onMoveUp: () => void;
  readonly onMoveDown: () => void;
}

export function StepCard({
  def,
  ordinal,
  total,
  expanded,
  connectedProviders,
  onToggleExpand,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: Props) {
  const kind = ROLE_TO_KIND[def.role];
  const effProvider: ProviderId =
    (def.providerOverride as ProviderId) || connectedProviders[0] || 'anthropic';
  const modelValue = def.modelOverride || getDefaultTurnModel(effProvider);

  const onModelChange = (model: string) => {
    const levels = modelEffortLevels(model);
    const patch: Partial<DefinitionForm> = { modelOverride: model };
    if (levels && !levels.includes(def.effort)) patch.effort = levels[0]!;
    onUpdate(patch);
  };

  return (
    <div className="relative overflow-hidden rounded-lg border border-border-soft bg-background">
      <span
        className={cn('absolute inset-y-0 left-0 w-1', AGENT_KIND_PALETTE[kind].bg)}
        aria-hidden
      />

      <div className="flex items-center gap-2 py-2 pl-4 pr-2">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted/50 text-2xs font-mono font-semibold text-muted-foreground">
          {ordinal + 1}
        </span>
        <AgentAvatar kind={kind} size="sm" />
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="truncate text-xs font-medium text-foreground">
            {def.name || 'untitled step'}
          </span>
          <span
            className={cn(
              'hidden shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide sm:inline',
              AGENT_KIND_PALETTE[kind].fg,
              'bg-foreground/5',
            )}
          >
            {ROLE_LABEL[def.role]}
          </span>
          {!expanded ? (
            <span className="ml-auto hidden shrink-0 truncate font-mono text-[10px] text-muted-foreground/50 md:inline">
              {shortModel(modelValue)} · {def.verbosity}
            </span>
          ) : null}
        </button>
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            className="rounded p-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground disabled:opacity-25"
            onClick={onMoveUp}
            disabled={ordinal === 0}
            title="move up"
            aria-label="move step up"
          >
            <ChevronUp size={13} aria-hidden />
          </button>
          <button
            type="button"
            className="rounded p-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground disabled:opacity-25"
            onClick={onMoveDown}
            disabled={ordinal === total - 1}
            title="move down"
            aria-label="move step down"
          >
            <ChevronDown size={13} aria-hidden />
          </button>
          <button
            type="button"
            className="rounded p-1 text-muted-foreground hover:bg-danger/10 hover:text-danger"
            onClick={onRemove}
            title="remove step"
            aria-label="remove step"
          >
            <X size={13} aria-hidden />
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="flex flex-col gap-3 px-4 pb-3 pl-4">
          <div className="flex items-center gap-2">
            <Input
              value={def.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              placeholder="step name"
              className="h-7 flex-1 text-xs font-medium"
            />
            <div className="w-44 shrink-0">
              <RoleSelect
                value={def.role}
                onChange={(role) => onUpdate({ role })}
                disabled={false}
              />
            </div>
          </div>

          <Textarea
            value={def.promptPrefix}
            onChange={(e) => onUpdate({ promptPrefix: e.target.value })}
            placeholder="role instructions for this step…"
            rows={3}
            autoGrow
            minRows={3}
            maxRows={12}
            className="font-mono text-2xs"
          />

          <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
            <InlineField label="Provider">
              <ProviderSelect
                value={(def.providerOverride as ProviderId) || ''}
                providers={connectedProviders}
                onChange={(p) => onUpdate({ providerOverride: p })}
                disabled={false}
              />
            </InlineField>
            <InlineField label="Model">
              <ModelSelect
                provider={effProvider}
                value={modelValue}
                onChange={onModelChange}
                disabled={false}
              />
            </InlineField>
            <InlineField label="Effort">
              <EffortSelect
                model={modelValue}
                value={def.effort}
                onChange={(effort) => onUpdate({ effort })}
                disabled={false}
              />
            </InlineField>
            <InlineField label="Verbosity">
              <VerbositySelect
                value={def.verbosity}
                onChange={(verbosity) => onUpdate({ verbosity })}
                disabled={false}
              />
            </InlineField>
          </div>
        </div>
      ) : null}
    </div>
  );
}
