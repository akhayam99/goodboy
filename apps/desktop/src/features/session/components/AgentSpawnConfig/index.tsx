import { useShallow } from 'zustand/react/shallow';
import { cn } from '@goodboy/ui';
import { RoutingPicker } from '../../../../shared/components/RoutingPicker';
import { useAppStore } from '../../../../store';
import { AGENT_FORM_GRAMMAR, type AgentFormRole } from '../../agent-form-grammar';
import { AgentInstructionsField } from '../AgentInstructionsField';
import { AgentRoleField } from '../AgentRoleField';
import type { AgentSpawnConfigValue } from '../../agentSpawnConfigValue';

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
        effort={{ editable: true, value: value.effort }}
        disabled={disabled}
        onChange={(route) => onChange({ ...value, ...route })}
      />
    </div>
  );
};
