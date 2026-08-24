import { useRef, useState } from 'react';
import { Input, Textarea, Tooltip } from '@goodboy/ui';
import { X } from 'lucide-react';
import { recommendedModelForRole } from '@goodboy/core';
import type {
  AgentEffort,
  AgentRole,
  ProviderId,
  StepDef,
  VerbosityLevel,
  WorkspaceId,
} from '@goodboy/types';
import type { StepDefUpsertArgs } from '../../workflows';
import { clampEffort, type EffortLevel } from '../../../chat/utils/chat-constants';
import { RoleSelect } from '../../../session/components/RoleSelect';
import { InlineField } from '../../../session/components/InlineField';
import { RoutingPicker } from '../../../../shared/components/RoutingPicker';
import { useAppStore } from '../../../../store';

type Props = {
  readonly def: StepDef | null;
  readonly workspaceId: WorkspaceId;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly onCommit: (args: StepDefUpsertArgs) => void;
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
  const roleModels = useAppStore((s) => s.workspaceOverrides?.[workspaceId]?.roleModels ?? null);
  const isGlobal = def?.workspaceId === null;
  const [name, setName] = useState(def?.name ?? '');
  const [role, setRole] = useState<AgentRole>(def?.role ?? 'custom');
  const [promptPrefix, setPromptPrefix] = useState(def?.promptPrefix ?? '');
  const [providerOverride, setProviderOverride] = useState<ProviderId | ''>(
    (def?.providerDefault as ProviderId | undefined) ?? '',
  );
  const pendingProvider = useRef<ProviderId | ''>(
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
  const effProvider: ProviderId = providerOverride !== '' ? providerOverride : recommendedProv;
  const recommendedMod: string = recommendedModelForRole({
    role,
    provider: effProvider,
    prefs: roleModels,
  });

  type FormState = {
    name: string;
    role: AgentRole;
    promptPrefix: string;
    providerOverride: ProviderId | '';
    modelOverride: string;
    effort: EffortLevel;
    verbosity: VerbosityLevel;
  };

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
    } else {
      onCommit(base);
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
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
            aria-label="Close step editor"
            className="shrink-0 rounded-md p-1 text-muted-foreground motion-safe:transition-colors hover:bg-muted/50 hover:text-foreground"
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
        <div className="col-span-2">
          <InlineField label="Provider, model, effort">
            <RoutingPicker
              ariaLabel="Step routing"
              connectedProviders={connectedProviders}
              provider={providerOverride}
              model={modelOverride}
              effort={{
                editable: true,
                value: effort,
                onChange: (eff) => {
                  setEffort(eff);
                  commit({ effort: eff });
                },
              }}
              recommendation={{ provider: recommendedProv, model: recommendedMod }}
              verbosity={verbosity}
              disabled={false}
              onProvider={(p) => {
                pendingProvider.current = p;
                setProviderOverride(p);
                commit({ providerOverride: p });
              }}
              onModel={(m) => {
                const clamped = clampEffort(m === '' ? recommendedMod : m, effort);
                setModelOverride(m);
                const over: Partial<FormState> = {
                  modelOverride: m,
                  providerOverride: pendingProvider.current,
                };
                if (clamped !== effort) {
                  setEffort(clamped);
                  over.effort = clamped;
                }
                commit(over);
              }}
              onVerbosity={(next) => {
                setVerbosity(next);
                commit({ verbosity: next });
              }}
            />
          </InlineField>
        </div>
      </div>
    </div>
  );
};
