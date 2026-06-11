import { Input, Textarea, cn } from '@goodboy/ui';
import { X } from 'lucide-react';
import { autoModelForRole, getDefaultTurnModel } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';
import type { DefinitionForm } from '../../form';
import { AGENT_KIND_PALETTE, ROLE_LABEL, ROLE_TO_KIND } from '../../../session/agent-kind';
import { modelEffortLevels } from '../../../chat/utils/chat-constants';
import { RoleSelect } from '../../../session/components/RoleSelect';
import { InlineField } from '../../../session/components/InlineField';
import { ModelSelect } from '../../../session/components/ModelSelect';
import { EffortSelect } from '../../../session/components/EffortSelect';
import { VerbositySelect } from '../../../session/components/VerbositySelect';
import { ProviderSelect } from '../../../session/components/ProviderSelect';

type Props = {
  readonly def: DefinitionForm;
  readonly ordinal: number;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly onUpdate: (patch: Partial<DefinitionForm>) => void;
  readonly onClose: () => void;
};

export const StepEditor = ({ def, ordinal, connectedProviders, onUpdate, onClose }: Props) => {
  const kind = ROLE_TO_KIND[def.role];
  const effProvider: ProviderId =
    (def.providerOverride as ProviderId) || connectedProviders[0] || 'anthropic';
  const autoModel = autoModelForRole(def.role, connectedProviders)?.model;
  const effortModel = def.modelOverride || autoModel || getDefaultTurnModel(effProvider);

  const onModelChange = (model: string) => {
    const levels = modelEffortLevels(model);
    const patch: Partial<DefinitionForm> = { modelOverride: model };
    if (levels && !levels.includes(def.effort)) {
      patch.effort = levels[0]!;
    }
    onUpdate(patch);
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border-soft bg-muted/10 p-4">
      <div className="flex items-center gap-2">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted/60 text-2xs font-mono font-semibold text-muted-foreground">
          {ordinal + 1}
        </span>
        <span className="text-xs font-semibold text-foreground">
          {def.name.trim() || 'Untitled step'}
        </span>
        <span className={cn('text-2xs font-medium', AGENT_KIND_PALETTE[kind].fg)}>
          {ROLE_LABEL[def.role]}
        </span>
        <button
          type="button"
          onClick={onClose}
          title="collapse"
          aria-label="collapse step editor"
          className="ml-auto rounded p-1 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        >
          <X size={13} aria-hidden />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={def.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="step name"
          className="h-7 flex-1 text-xs font-medium"
        />
        <div className="w-44 shrink-0">
          <RoleSelect value={def.role} onChange={(role) => onUpdate({ role })} disabled={false} />
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
            value={def.modelOverride}
            onChange={onModelChange}
            disabled={false}
            allowAuto
          />
        </InlineField>
        <InlineField label="Effort">
          <EffortSelect
            model={effortModel}
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
  );
};
