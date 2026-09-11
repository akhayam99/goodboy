import { useShallow } from 'zustand/react/shallow';
import { getDefaultTurnModel, getModelProvider } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';
import { cn } from '@goodboy/ui';
import { clampEffort } from '../../../chat/utils/chat-constants';
import { RoutingPicker } from '../../../../shared/components/RoutingPicker';
import { useAppStore } from '../../../../store';
import { AGENT_FORM_GRAMMAR, type AgentFormRole } from '../../agent-form-grammar';
import { AgentInstructionsField } from '../AgentInstructionsField';
import { AgentRoleField } from '../AgentRoleField';
import type { AgentSpawnConfigValue } from './AgentSpawnConfigValue';
import { DEFAULT_AGENT_SPAWN_CONFIG } from './defaultAgentSpawnConfig';

type Props = {
  readonly value: AgentSpawnConfigValue;
  readonly onChange: (value: AgentSpawnConfigValue) => void;
  readonly disabled: boolean;
  readonly className?: string;
  readonly role?: AgentFormRole;
};

export const AgentSpawnConfig = ({ value, onChange, disabled, className, role }: Props) => {
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
        : getDefaultTurnModel({ id: provider });
    onChange({
      ...value,
      provider,
      model,
      effort: clampEffort(model, DEFAULT_AGENT_SPAWN_CONFIG.effort),
    });
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {role != null && <AgentRoleField role={role} />}
      <AgentInstructionsField
        value={value.hint}
        onChange={(hint) => onChange({ ...value, hint })}
        disabled={disabled}
      />
      <RoutingPicker
        ariaLabel={AGENT_FORM_GRAMMAR.routing.ariaLabel}
        connectedProviders={connectedProviders}
        provider={value.provider}
        model={value.model}
        effort={{
          editable: true,
          value: value.effort,
          onChange: (effort) => onChange({ ...value, effort }),
        }}
        disabled={disabled}
        onProvider={onProvider}
        onModel={(model) => onChange({ ...value, model, effort: clampEffort(model, value.effort) })}
      />
    </div>
  );
};
