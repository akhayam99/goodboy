import { useEffect, useRef, useState } from 'react';
import { getDefaultTurnModel } from '@goodboy/core';
import type { ModelEffort, OrchestratorRouting, ProviderId } from '@goodboy/types';
import { clampEffort, modelEffortLevels } from '../../chat/utils/chat-constants';
import { RoutingPicker } from '../../../shared/components/RoutingPicker';

type Props = {
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly defaultProvider: ProviderId;
  readonly routing: OrchestratorRouting | null;
  readonly disabled: boolean;
  readonly variant?: 'field' | 'pill';
  readonly onChange: (routing: OrchestratorRouting | null) => void;
};

type EffortParams = {
  readonly model: string;
  readonly requested: ModelEffort;
};

const DEFAULT_EFFORT: ModelEffort = 'medium';

const effortForModel = ({ model, requested }: EffortParams): ModelEffort | null =>
  modelEffortLevels(model) == null ? null : clampEffort(model, requested);

export const WorkflowStepRoutingPicker = ({
  connectedProviders,
  defaultProvider,
  routing,
  disabled,
  variant = 'field',
  onChange,
}: Props) => {
  const initialProvider = routing?.providerId ?? defaultProvider;
  const [providerId, setProviderId] = useState<ProviderId>(initialProvider);
  const providerRef = useRef(initialProvider);
  const modelRef = useRef(routing?.model ?? getDefaultTurnModel({ id: initialProvider }));
  const defaultModel = getDefaultTurnModel({ id: defaultProvider });
  const model = routing?.model ?? '';
  const effortModel = model === '' ? getDefaultTurnModel({ id: providerId }) : model;
  const effortValue = routing?.effort ?? DEFAULT_EFFORT;

  useEffect(() => {
    const nextProvider = routing?.providerId ?? defaultProvider;
    providerRef.current = nextProvider;
    modelRef.current = routing?.model ?? getDefaultTurnModel({ id: nextProvider });
    setProviderId(nextProvider);
  }, [defaultProvider, routing]);

  return (
    <RoutingPicker
      ariaLabel="step agent routing"
      variant={variant}
      connectedProviders={connectedProviders}
      provider={providerId}
      model={model}
      effort={{
        editable: true,
        value: effortForModel({ model: effortModel, requested: effortValue }) ?? effortValue,
        onChange: (effort) => {
          const applied = effortForModel({ model: modelRef.current, requested: effort });
          onChange({
            providerId: providerRef.current,
            model: modelRef.current,
            ...(applied != null && { effort: applied }),
          });
        },
      }}
      recommendation={{ provider: defaultProvider, model: defaultModel }}
      disabled={disabled}
      overridden={routing != null}
      defaultSummary="role defaults"
      onReset={() => onChange(null)}
      onProvider={(next) => {
        const nextProvider = next === '' ? defaultProvider : next;
        providerRef.current = nextProvider;
        setProviderId(nextProvider);
        if (next === '') {
          modelRef.current = defaultModel;
          onChange(null);
        }
      }}
      onModel={(nextModel) => {
        if (nextModel === '') {
          modelRef.current = defaultModel;
          onChange(null);
          return;
        }
        modelRef.current = nextModel;
        const applied = effortForModel({ model: nextModel, requested: effortValue });
        onChange({
          providerId: providerRef.current,
          model: nextModel,
          ...(applied != null && { effort: applied }),
        });
      }}
    />
  );
};
