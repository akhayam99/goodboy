import { useState } from 'react';
import { Button, Input, Textarea } from '@goodboy/ui';
import { getDefaultTurnModel } from '@goodboy/core';
import type {
  AgentEffort,
  AgentRole,
  ProviderId,
  StepDef,
  VerbosityLevel,
  WorkspaceId,
} from '@goodboy/types';
import type { StepDefUpsertArgs } from '../../workflows';
import { modelEffortLevels, type EffortLevel } from '../../../chat/utils/chat-constants';
import { RoleSelect } from '../../../session/components/RoleSelect';
import { InlineField } from '../../../session/components/InlineField';
import { ModelSelect } from '../../../session/components/ModelSelect';
import { EffortSelect } from '../../../session/components/EffortSelect';
import { VerbositySelect } from '../../../session/components/VerbositySelect';
import { ProviderSelect } from '../../../session/components/ProviderSelect';

interface Props {
  readonly def: StepDef | null;
  readonly workspaceId: WorkspaceId;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly onSave: (args: StepDefUpsertArgs) => void;
  readonly onCancel: () => void;
}

const DEFAULT_EFFORT: EffortLevel = 'medium';
const DEFAULT_VERBOSITY: VerbosityLevel = 'normal';

export function LibraryStepForm({ def, workspaceId, connectedProviders, onSave, onCancel }: Props) {
  const isGlobal = def?.workspaceId === null;
  const [name, setName] = useState(def?.name ?? '');
  const [role, setRole] = useState<AgentRole>(def?.role ?? 'custom');
  const [promptPrefix, setPromptPrefix] = useState(def?.promptPrefix ?? '');
  const [providerOverride, setProviderOverride] = useState<ProviderId | ''>(
    (def?.providerDefault as ProviderId | undefined) ?? '',
  );
  const [modelOverride, setModelOverride] = useState(def?.modelDefault ?? '');
  const [effort, setEffort] = useState<EffortLevel>(
    (def?.effortDefault as EffortLevel | undefined) ?? DEFAULT_EFFORT,
  );
  const [verbosity, setVerbosity] = useState<VerbosityLevel>(
    def?.verbosityDefault ?? DEFAULT_VERBOSITY,
  );

  const effProvider: ProviderId = providerOverride || connectedProviders[0] || 'anthropic';
  const modelValue = modelOverride || getDefaultTurnModel(effProvider);

  const canSave = name.trim().length > 0;

  const submit = () => {
    if (!canSave) return;
    const base: StepDefUpsertArgs = {
      workspaceId,
      role,
      name: name.trim(),
      promptPrefix,
      ...(providerOverride ? { providerDefault: providerOverride } : {}),
      ...(modelOverride.trim() ? { modelDefault: modelOverride.trim() } : {}),
      effortDefault: effort as AgentEffort,
      verbosityDefault: verbosity,
    };
    if (def && !isGlobal) {
      onSave({ ...base, id: def.id });
    } else if (def && isGlobal) {
      onSave({ ...base, baseStepId: def.id });
    } else {
      onSave(base);
    }
  };

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-primary/40 bg-background p-3">
      <div className="flex items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="step name"
          className="h-7 flex-1 text-xs font-medium"
        />
        <div className="w-36 shrink-0">
          <RoleSelect value={role} onChange={setRole} disabled={false} />
        </div>
      </div>

      {isGlobal ? (
        <p className="text-2xs leading-relaxed text-muted-foreground/70">
          Editing a global step saves a copy in this workspace. The shared original stays unchanged.
        </p>
      ) : null}

      <Textarea
        value={promptPrefix}
        onChange={(e) => setPromptPrefix(e.target.value)}
        placeholder="default role instructions…"
        rows={3}
        autoGrow
        minRows={3}
        maxRows={10}
        className="font-mono text-2xs"
      />

      <div className="grid grid-cols-2 gap-2.5">
        <InlineField label="Provider">
          <ProviderSelect
            value={providerOverride}
            providers={connectedProviders}
            onChange={setProviderOverride}
            disabled={false}
          />
        </InlineField>
        <InlineField label="Model">
          <ModelSelect
            provider={effProvider}
            value={modelValue}
            onChange={(m) => {
              const levels = modelEffortLevels(m);
              setModelOverride(m);
              if (levels && !levels.includes(effort)) setEffort(levels[0]!);
            }}
            disabled={false}
          />
        </InlineField>
        <InlineField label="Effort">
          <EffortSelect model={modelValue} value={effort} onChange={setEffort} disabled={false} />
        </InlineField>
        <InlineField label="Verbosity">
          <VerbositySelect value={verbosity} onChange={setVerbosity} disabled={false} />
        </InlineField>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={submit} disabled={!canSave}>
          Save
        </Button>
      </div>
    </div>
  );
}
