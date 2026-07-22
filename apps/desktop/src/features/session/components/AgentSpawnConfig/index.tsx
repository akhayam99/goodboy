import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { getDefaultTurnModel, getModelProvider } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';
import { cn } from '@goodboy/ui';
import { ChevronDown, Sliders } from 'lucide-react';
import {
  EFFORT_LABEL,
  PROVIDER_LABEL,
  clampEffort,
  modelEffortLevels,
} from '../../../chat/utils/chat-constants';
import { shortModelWithVersion } from '../../agent-row-format';
import { useAppStore } from '../../../../store';
import { EffortSelect } from '../EffortSelect';
import { ModelSelect } from '../ModelSelect';
import { ProviderSelect } from '../ProviderSelect';
import type { AgentSpawnConfigValue } from './AgentSpawnConfigValue';
import { DEFAULT_AGENT_SPAWN_CONFIG } from './defaultAgentSpawnConfig';

type Props = {
  readonly value: AgentSpawnConfigValue;
  readonly onChange: (value: AgentSpawnConfigValue) => void;
  readonly disabled: boolean;
  readonly className?: string;
};

export const AgentSpawnConfig = ({ value, onChange, disabled, className }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const connectedProviders = useAppStore(
    useShallow((state) =>
      state.providers.filter((provider) => provider.connection === 'connected').map(({ id }) => id),
    ),
  );
  const defaultModelProvider = getModelProvider(DEFAULT_AGENT_SPAWN_CONFIG.model) ?? 'anthropic';
  const modelProvider =
    value.provider !== ''
      ? value.provider
      : (getModelProvider(value.model) ?? defaultModelProvider);

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

  const onModel = (model: string) => {
    onChange({ ...value, model, effort: clampEffort(model, value.effort) });
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        disabled={disabled}
        aria-expanded={isOpen}
        className="inline-flex w-full items-center gap-1.5 rounded-md border border-border-soft bg-subtle px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted/50 disabled:opacity-50"
      >
        <Sliders size={12} aria-hidden className="shrink-0 text-muted-foreground" />
        <span className="text-muted-foreground">Agent settings</span>
        <span className="min-w-0 flex-1 truncate font-medium text-foreground">
          {value.provider === '' ? 'Session routing' : PROVIDER_LABEL[value.provider]} ·{' '}
          {shortModelWithVersion(value.model)}
          {modelEffortLevels(value.model) != null ? ` · ${EFFORT_LABEL[value.effort]}` : ''}
        </span>
        <ChevronDown
          size={11}
          aria-hidden
          className={cn(
            'shrink-0 text-muted-foreground transition-transform',
            isOpen && 'rotate-180',
          )}
        />
      </button>
      {isOpen ? (
        <div className="flex flex-col gap-2 rounded-lg border border-border-soft bg-background p-2 text-left">
          <ProviderSelect
            value={value.provider}
            providers={connectedProviders}
            onChange={onProvider}
            disabled={disabled || connectedProviders.length === 0}
          />
          <ModelSelect
            provider={modelProvider}
            value={value.model}
            onChange={onModel}
            disabled={disabled}
          />
          <EffortSelect
            model={value.model}
            value={value.effort}
            onChange={(effort) => onChange({ ...value, effort })}
            disabled={disabled}
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
      ) : null}
    </div>
  );
};
