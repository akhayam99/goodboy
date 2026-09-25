import { useShallow } from 'zustand/react/shallow';
import { getDefaultTurnModel, clampEffortForModel } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';
import { cn } from '@goodboy/ui';
import { RoutingPicker } from '../../../../shared/components/RoutingPicker';
import { useAppStore } from '../../../../store';
import { AGENT_FORM_GRAMMAR, type AgentFormRole } from '../../agent-form-grammar';
import { AgentInstructionsField } from '../AgentInstructionsField';
import { AgentRoleField } from '../AgentRoleField';
import type { AgentSpawnConfigValue } from './AgentSpawnConfigValue';

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
  const onProvider = (provider: ProviderId | '') => {
    if (provider === '') {
      return;
    }
    const model = getDefaultTurnModel({ id: provider });
    onChange({
      ...value,
      provider,
      model,
      effort: clampEffortForModel({ model, effort: value.effort }) ?? value.effort,
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
        onModel={(model) =>
          onChange({
            ...value,
            model,
            effort: clampEffortForModel({ model, effort: value.effort }) ?? value.effort,
          })
        }
      />
    </div>
  );
};
