import { useState } from 'react';
import { Input, Textarea, Tooltip } from '@goodboy/ui';
import { X } from 'lucide-react';
import { autoModelForRole, getDefaultTurnModel } from '@goodboy/core';
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

type Props = {
  readonly def: StepDef | null;
  readonly workspaceId: WorkspaceId;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  // Commit the current values without closing the editor (blur-driven autosave).
  readonly onCommit: (args: StepDefUpsertArgs) => void;
  // Close the editor; for an unsaved new step this discards it.
  readonly onClose: () => void;
};

const DEFAULT_EFFORT: EffortLevel = 'medium';
const DEFAULT_VERBOSITY: VerbosityLevel = 'normal';

export const LibraryStepForm = ({
  def,
  workspaceId,
  connectedProviders,
  onCommit,
  onClose,
}: Props) => {
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

  const recommendedProv: ProviderId = connectedProviders[0] ?? 'anthropic';
  const recommendedMod: string =
    autoModelForRole(role, [recommendedProv])?.model ?? getDefaultTurnModel(recommendedProv);
  const effProvider: ProviderId = providerOverride !== '' ? providerOverride : recommendedProv;
  const modelValue = modelOverride !== '' ? modelOverride : recommendedMod;

  type FormState = {
    name: string;
    role: AgentRole;
    promptPrefix: string;
    providerOverride: ProviderId | '';
    modelOverride: string;
    effort: EffortLevel;
    verbosity: VerbosityLevel;
  };

  // Build args from a partial override so a freshly-changed select commits its new
  // value immediately rather than the stale state captured in this render.
  const commit = (over: Partial<FormState> = {}) => {
    const next: FormState = {
      name,
      role,
      promptPrefix,
      providerOverride,
      modelOverride,
      effort,
      verbosity,
      ...over,
    };
    if (next.name.trim().length === 0) {
      return;
    }
    const base: StepDefUpsertArgs = {
      workspaceId,
      role: next.role,
      name: next.name.trim(),
      promptPrefix: next.promptPrefix,
      ...(next.providerOverride ? { providerDefault: next.providerOverride } : {}),
      ...(next.modelOverride.trim() ? { modelDefault: next.modelOverride.trim() } : {}),
      effortDefault: next.effort as AgentEffort,
      verbosityDefault: next.verbosity,
    };
    if (def && !isGlobal) {
      onCommit({ ...base, id: def.id });
    } else if (def && isGlobal) {
      onCommit({ ...base, baseStepId: def.id });
    } else {
      onCommit(base);
    }
  };

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-primary/40 bg-background p-3">
      <div className="flex items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => commit()}
          placeholder="step name"
          className="h-7 flex-1 text-xs font-medium"
        />
        <div className="w-36 shrink-0">
          <RoleSelect
            value={role}
            onChange={(r) => {
              setRole(r);
              commit({ role: r });
            }}
            disabled={false}
          />
        </div>
        <Tooltip content="close">
          <button
            type="button"
            onClick={onClose}
            aria-label="close step editor"
            className="shrink-0 rounded p-1 text-muted-foreground motion-safe:transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            <X size={13} aria-hidden />
          </button>
        </Tooltip>
      </div>

      {isGlobal ? (
        <p className="text-2xs leading-relaxed text-muted-foreground/70">
          Editing a global step saves a copy in this workspace. The shared original stays unchanged.
        </p>
      ) : null}

      <Textarea
        value={promptPrefix}
        onChange={(e) => setPromptPrefix(e.target.value)}
        onBlur={() => commit()}
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
            recommended={recommendedProv}
            onChange={(p) => {
              setProviderOverride(p);
              commit({ providerOverride: p });
            }}
            disabled={false}
          />
        </InlineField>
        <InlineField label="Model">
          <ModelSelect
            provider={effProvider}
            value={modelValue}
            recommendedModel={recommendedMod}
            allowAuto
            onChange={(m) => {
              const levels = modelEffortLevels(m);
              setModelOverride(m);
              const over: Partial<FormState> = { modelOverride: m };
              if (levels && !levels.includes(effort)) {
                setEffort(levels[0]!);
                over.effort = levels[0]!;
              }
              commit(over);
            }}
            disabled={false}
          />
        </InlineField>
        <InlineField label="Effort">
          <EffortSelect
            model={modelValue}
            value={effort}
            onChange={(eff) => {
              setEffort(eff);
              commit({ effort: eff });
            }}
            disabled={false}
          />
        </InlineField>
        <InlineField label="Verbosity">
          <VerbositySelect
            value={verbosity}
            onChange={(v) => {
              setVerbosity(v);
              commit({ verbosity: v });
            }}
            disabled={false}
          />
        </InlineField>
      </div>
    </div>
  );
};
