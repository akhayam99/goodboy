import { Input, Textarea } from '@goodboy/ui';
import { autoModelForRole, getDefaultTurnModel } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';
import type { DefinitionForm } from '../../form';
import { modelEffortLevels } from '../../../chat/utils/chat-constants';
import { RoleSelect } from '../../../session/components/RoleSelect';
import { InlineField } from '../../../session/components/InlineField';
import { ModelSelect } from '../../../session/components/ModelSelect';
import { EffortSelect } from '../../../session/components/EffortSelect';
import { VerbositySelect } from '../../../session/components/VerbositySelect';
import { ProviderSelect } from '../../../session/components/ProviderSelect';

type Props = {
  readonly def: DefinitionForm;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly onUpdate: (patch: Partial<DefinitionForm>) => void;
};

export const StepEditor = ({ def, connectedProviders, onUpdate }: Props) => {
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
    <div className="flex flex-col gap-3 rounded-md bg-muted/20 p-3">
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
