import { useShallow } from 'zustand/react/shallow';
import { getDefaultTurnModel, getModelProvider } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';
import { cn } from '@goodboy/ui';
import { clampEffort } from '../../../chat/utils/chat-constants';
import { RoutingPicker } from '../../../../shared/components/RoutingPicker';
import { useAppStore } from '../../../../store';
import type { AgentSpawnConfigValue } from './AgentSpawnConfigValue';
import { DEFAULT_AGENT_SPAWN_CONFIG } from './defaultAgentSpawnConfig';

type Props = {
  readonly value: AgentSpawnConfigValue;
  readonly onChange: (value: AgentSpawnConfigValue) => void;
  readonly disabled: boolean;
  readonly className?: string;
};

export const AgentSpawnConfig = ({ value, onChange, disabled, className }: Props) => {
  const connectedProviders = useAppStore(
    useShallow((state) =>
      state.providers.filter((provider) => provider.connection === 'connected').map(({ id }) => id),
    ),
  );
  const defaultModelProvider = getModelProvider(DEFAULT_AGENT_SPAWN_CONFIG.model) ?? 'anthropic';

  const onProvider = (provider: ProviderId | '') => {
    if (provider === '') {
      onChange({ ...value, ...DEFAULT_AGENT_SPAWN_CONFIG, hint: value.hint });
      return;
    }
    const model =
      provider === defaultModelProvider
        ? DEFAULT_AGENT_SPAWN_CONFIG.model
        : getDefaultTurnModel(provider);
    onChange({
      ...value,
      provider,
      model,
      effort: clampEffort(model, DEFAULT_AGENT_SPAWN_CONFIG.effort),
    });
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <RoutingPicker
        ariaLabel="Agent settings"
        providers={connectedProviders}
        provider={value.provider}
        model={value.model}
        effort={value.effort}
        disabled={disabled}
        onProvider={onProvider}
        onModel={(model) => onChange({ ...value, model, effort: clampEffort(model, value.effort) })}
        onEffort={(effort) => onChange({ ...value, effort })}
      />
      <textarea
        aria-label="Agent hint"
        value={value.hint}
        onChange={(event) => onChange({ ...value, hint: event.target.value })}
        rows={2}
        disabled={disabled}
        placeholder="Optional notes for the agent: what to emphasize, what to avoid..."
        className="w-full resize-none rounded-md border border-border-soft bg-subtle px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none disabled:opacity-50"
      />
    </div>
  );
};
